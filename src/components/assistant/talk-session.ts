"use client";

import { openMic, type Mic } from "./mic";
import {
  completeSentences,
  createSpeaker,
  join,
  micErrorMessage,
  sentencesOf,
  speakable,
  stopSpeaking,
  transcribeRecording,
  unlockAudio,
  type Speaker,
  type SpeechLang,
} from "./speech";
import { isGoodbye, isHush, isStopListening } from "./wake-word";

// A live spoken conversation: the microphone stays on, turns are found by the
// speech detector, and replies are spoken sentence by sentence as they arrive.
// It keeps going through noise and network drops until it's ended, so someone
// riding a bicycle never has to look at or touch the phone.

export type TalkPhase = "idle" | "starting" | "listening" | "thinking" | "speaking" | "paused";

// Short, because a pause mid-sentence is forgiven: speech that resumes while
// the last part is still being transcribed joins the same turn.
const END_OF_TURN_MS = 900;
// Nothing is sent anywhere during silence, so this is about the battery and
// not leaving a microphone on by accident.
const HANG_UP_AFTER_QUIET_MS = 30 * 60_000;
const TRANSCRIBE_RETRY_MS = 800;
const WAITING_TICK_MS = 3000;
const NO_REPLY_TIMEOUT_MS = 90_000;

const SAY_MISHEARD = "Sorry, the network's weak and I missed that. Say it again?";
const SAY_FAILED = "Sorry, something went wrong there. Try asking again.";
const SAY_BYE = "Okay, bye!";
const SAY_QUIET = "It's been quiet for a while, so I'll hang up. Bye!";

export type TalkSession = {
  start: () => void;
  end: () => void;
  /** Tap the orb: resume if paused, send what's been said, or stop a reply. */
  tap: () => void;
  replyChanged: (id: string, text: string) => void;
  replyFinished: (reply: { text: string; isError: boolean }) => void;
};

export function createTalkSession(
  lang: SpeechLang,
  events: {
    onPhase: (phase: TalkPhase) => void;
    onError: (message: string) => void;
    send: (text: string) => void;
  },
): TalkSession {
  let phase: TalkPhase = "idle";
  let active = false;
  let mic: Mic | null = null;
  let wakeLock: WakeLockSentinel | null = null;

  // Hearing
  let speakingNow = false; // the person is talking at this moment
  let transcribing = 0;
  let transcripts = Promise.resolve(); // keeps parts of a turn in order
  let heard = "";
  // A take that started while the assistant was speaking is thrown away
  let dropNextEnd = false;

  // Replying
  let speaker: Speaker | null = null;
  let replyPending = false;
  let dropReply = false; // what's being written has been talked over
  let nextTurn = "";
  let staleReplyId: string | null = null;
  let lastReplyId: string | null = null;
  let spokenChars = 0;

  // Timers
  let quietTimer: ReturnType<typeof setTimeout> | undefined;
  let waitingTimer: ReturnType<typeof setInterval> | undefined;
  let replyTimer: ReturnType<typeof setTimeout> | undefined;

  // Small sounds, so nobody has to look at a screen to know they were heard
  let sounds: AudioContext | null = null;
  function tone(frequency: number, seconds = 0.09, volume = 0.05) {
    if (!sounds) return;
    const osc = sounds.createOscillator();
    const gain = sounds.createGain();
    const now = sounds.currentTime;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(gain).connect(sounds.destination);
    osc.start(now);
    osc.stop(now + seconds);
  }

  function setPhase(next: TalkPhase) {
    if (phase === next) return;
    phase = next;
    events.onPhase(next);
  }

  const restPhase = (): TalkPhase =>
    speaker ? "speaking" : replyPending || transcribing ? "thinking" : "listening";

  function resetQuietTimer() {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => sayThenEnd(SAY_QUIET), HANG_UP_AFTER_QUIET_MS);
  }

  function stopWaiting() {
    clearInterval(waitingTimer);
    clearTimeout(replyTimer);
    waitingTimer = undefined;
  }

  function startWaiting() {
    stopWaiting();
    waitingTimer = setInterval(() => tone(520, 0.05, 0.025), WAITING_TICK_MS);
    // A reply that never comes mustn't leave the conversation stuck
    replyTimer = setTimeout(() => session.replyFinished({ text: "", isError: true }), NO_REPLY_TIMEOUT_MS);
  }

  function ensureSpeaker() {
    speaker ??= createSpeaker(lang, {
      onStart: () => {
        stopWaiting();
        dropNextEnd = true;
        speakingNow = false;
        mic?.listen(false);
        setPhase("speaking");
      },
    });
    return speaker;
  }

  function stopReplyAudio() {
    speaker?.stop();
    speaker = null;
    mic?.listen(true);
  }

  function cutReply() {
    dropNextEnd = true;
    speakingNow = false;
    if (replyPending) dropReply = true;
    nextTurn = "";
    stopReplyAudio();
    stopWaiting();
    setPhase("listening");
  }

  function sayLine(text: string) {
    stopReplyAudio();
    const line = ensureSpeaker();
    line.say(text);
    finishSpeaking(line);
  }

  // Called once everything for this reply has been queued
  function finishSpeaking(line: Speaker) {
    line.end();
    void line.finished.then(() => {
      if (speaker !== line) return;
      speaker = null;
      mic?.listen(true);
      if (active && !speakingNow) setPhase(restPhase());
    });
  }

  function sayThenEnd(text: string) {
    stopReplyAudio();
    const line = createSpeaker(lang);
    line.say(text);
    line.end();
    closeMic();
    void line.finished.then(() => session.end());
  }

  function closeMic() {
    mic?.close();
    mic = null;
  }

  function pauseListening() {
    // Phase first, so a mic-lost callback from closeMic doesn't reconnect.
    setPhase("paused");
    clearTimeout(quietTimer);
    closeMic();
    stopReplyAudio();
    stopWaiting();
    speakingNow = false;
    heard = "";
    nextTurn = "";
    if (replyPending) dropReply = true;
    replyPending = false;
    void wakeLock?.release().catch(() => {});
    wakeLock = null;
    tone(330, 0.18, 0.05);
  }

  function resumeListening() {
    if (!active || phase !== "paused") return;
    setPhase("starting");
    void keepScreenOn();
    connectMic().then(
      () => {
        if (!active) return;
        tone(880, 0.12);
        resetQuietTimer();
        setPhase("listening");
      },
      (error) => {
        events.onError(micErrorMessage(error));
        session.end();
      },
    );
  }

  function sendTurn(text: string) {
    replyPending = true;
    dropReply = false;
    staleReplyId = lastReplyId;
    spokenChars = 0;
    setPhase("thinking");
    startWaiting();
    events.send(text);
  }

  // Runs whenever a recording has been dealt with or someone stops talking:
  // a turn is complete only once they've stopped and everything's transcribed.
  function settleTurn() {
    if (!active || speakingNow || transcribing > 0) return;
    const text = heard;
    heard = "";

    if (!text) return setPhase(restPhase());
    if (isStopListening(text)) return pauseListening();
    if (isGoodbye(text)) return sayThenEnd(SAY_BYE);

    stopReplyAudio();
    if (isHush(text)) {
      // Whatever is still being written won't be read out either
      if (replyPending) dropReply = true;
      stopWaiting();
      return setPhase("listening");
    }
    if (replyPending) {
      // Wait for the current reply to finish so it isn't cut off mid-change
      nextTurn = join(nextTurn, text);
      dropReply = true;
      return setPhase("thinking");
    }
    sendTurn(text);
  }

  async function transcribeWithRetry(wav: Blob) {
    try {
      return await transcribeRecording(wav);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, TRANSCRIBE_RETRY_MS));
      return transcribeRecording(wav);
    }
  }

  function onSpeechEnd(wav: Blob) {
    if (!active || phase === "paused") return;
    speakingNow = false;
    if (speaker || dropNextEnd) {
      dropNextEnd = false;
      return;
    }
    tone(660);
    resetQuietTimer();
    transcribing++;
    if (!speaker) setPhase("thinking");
    transcripts = transcripts.then(async () => {
      try {
        heard = join(heard, await transcribeWithRetry(wav));
      } catch {
        transcribing--;
        if (active) sayLine(SAY_MISHEARD);
        return;
      }
      transcribing--;
      settleTurn();
    });
  }

  async function connectMic() {
    mic = await openMic(
      {
        onSpeechStart: () => {
          if (phase === "paused") return;
          // Don't cut the answer off if they talk over it — tap the orb instead
          if (speaker) {
            dropNextEnd = true;
            return;
          }
          speakingNow = true;
          resetQuietTimer();
          setPhase("listening");
        },
        onMisfire: () => {
          speakingNow = false;
        },
        onSpeechEnd,
        onLost: () => void reconnectMic(),
      },
      { endSilenceMs: END_OF_TURN_MS },
    );
    if (!active) closeMic();
  }

  async function reconnectMic() {
    if (!active || phase === "paused") return;
    closeMic();
    speakingNow = false;
    try {
      await connectMic();
    } catch (error) {
      events.onError(micErrorMessage(error));
      session.end();
    }
  }

  async function keepScreenOn() {
    try {
      wakeLock = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      // Not supported or refused; the conversation still works
    }
  }

  function onVisibilityChange() {
    if (!active || document.visibilityState !== "visible" || phase === "paused") return;
    void keepScreenOn();
    void sounds?.resume();
    if (mic?.isLive()) mic.wake();
    else void reconnectMic();
  }

  const session: TalkSession = {
    start() {
      if (active) return;
      active = true;
      stopSpeaking();
      // All part of the tap, or browsers won't allow sound later
      unlockAudio();
      sounds = new AudioContext();
      void sounds.resume();
      setPhase("starting");
      document.addEventListener("visibilitychange", onVisibilityChange);
      void keepScreenOn();
      connectMic().then(
        () => {
          if (!active) return;
          tone(880, 0.12);
          resetQuietTimer();
          setPhase("listening");
        },
        (error) => {
          events.onError(micErrorMessage(error));
          session.end();
        },
      );
    },

    end() {
      if (!active) return;
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      closeMic();
      stopReplyAudio();
      stopWaiting();
      clearTimeout(quietTimer);
      void wakeLock?.release().catch(() => {});
      wakeLock = null;
      void sounds?.close();
      sounds = null;
      speakingNow = false;
      replyPending = false;
      heard = "";
      nextTurn = "";
      setPhase("idle");
    },

    tap() {
      if (!active) return;
      if (phase === "paused") return resumeListening();
      if (speaker) return cutReply();
      if (speakingNow) return mic?.flush();
    },

    replyChanged(id, text) {
      lastReplyId = id;
      if (!active || !replyPending || dropReply || id === staleReplyId) return;
      const { sentences, used } = completeSentences(text.slice(spokenChars));
      if (!sentences.length) return;
      spokenChars += used;
      const line = ensureSpeaker();
      for (const sentence of sentences) line.say(speakable(sentence));
    },

    replyFinished({ text, isError }) {
      if (!active || !replyPending) return;
      replyPending = false;
      stopWaiting();

      if (nextTurn) {
        // They said something while this reply was being written
        const queued = nextTurn;
        nextTurn = "";
        stopReplyAudio();
        return sendTurn(queued);
      }
      if (dropReply) {
        dropReply = false;
        return setPhase(restPhase());
      }
      if (isError && !text) return sayLine(SAY_FAILED);

      const rest = speakable(text.slice(spokenChars));
      if (!rest && !speaker) return setPhase(restPhase());
      const line = ensureSpeaker();
      for (const sentence of sentencesOf(rest)) line.say(sentence);
      finishSpeaking(line);
    },
  };

  return session;
}
