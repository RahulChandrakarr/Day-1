"use client";

import { canUseMic, openMic, type Mic } from "./mic";

// Listening goes through the server's speech model, which handles mixed Hindi
// and English and knows the names this person uses. Only waiting for the
// assistant's name uses the browser's own recognition, so that nothing leaves
// the device until the name is heard.

type SpeechResult = {
  isFinal: boolean;
  length: number;
  [alt: number]: { transcript: string };
};
type SpeechEvent = { resultIndex: number; results: { length: number; [i: number]: SpeechResult } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

export type SpeechLang = "en-IN" | "hi-IN";

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = canUseMic;
/** Can wait for the assistant's name on this device. */
export const canWake = () => recognitionCtor() !== null;
export const canSpeak = () =>
  typeof window !== "undefined" && ("Audio" in window || "speechSynthesis" in window);

export const SPEECH_ERRORS: Record<string, string> = {
  "not-allowed": "Allow microphone access to talk to the assistant.",
  "service-not-allowed": "Allow microphone access to talk to the assistant.",
  "audio-capture": "No microphone found.",
  network: "Voice needs an internet connection.",
};

export type Listener = {
  /** Finish now and hand over what was heard. */
  finish: () => void;
  /** Stop silently. */
  abort: () => void;
};

export const join = (...parts: string[]) =>
  parts.map((p) => p.trim()).filter(Boolean).join(" ");

export function micErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return SPEECH_ERRORS["not-allowed"];
  if (name === "NotFoundError") return SPEECH_ERRORS["audio-capture"];
  return "Couldn't start the microphone. Try again.";
}

// What was said in a recording; empty if it was only noise. Throws if the
// server can't be reached or can't make it out.
export async function transcribeRecording(wav: Blob) {
  const response = await fetch("/api/assistant/transcribe", {
    method: "POST",
    headers: { "Content-Type": "audio/wav" },
    body: wav,
  });
  if (!response.ok) throw new Error("Couldn't make out what you said. Try again.");
  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? "";
}

// One turn: listens until the speaker has been quiet for `pauseMs`, then hands
// over what they said. If nobody speaks for `idleMs` it gives up.
export function createListener(
  handlers: {
    /** The microphone is on: it's safe to start talking. */
    onReady?: () => void;
    /** Recording ended; the words are on their way. */
    onTranscribing?: () => void;
    onPause: (text: string) => void;
    onError?: (message: string) => void;
    onIdle?: () => void;
  },
  { pauseMs = 1600, idleMs = 25_000 }: { pauseMs?: number; idleMs?: number } = {},
): Listener {
  let mic: Mic | null = null;
  let stopped = false;
  let heardSpeech = false;
  let finishing = false;
  let aborted = false;
  const idleTimer = setTimeout(() => {
    if (heardSpeech) return;
    close();
    handlers.onIdle?.();
  }, idleMs);

  function close() {
    stopped = true;
    clearTimeout(idleTimer);
    mic?.close();
    mic = null;
  }

  function finishEmpty() {
    close();
    handlers.onPause("");
  }

  openMic(
    {
      onSpeechStart: () => {
        heardSpeech = true;
      },
      onMisfire: () => {
        if (finishing) finishEmpty();
      },
      onSpeechEnd: (wav) => {
        if (stopped) return;
        close();
        handlers.onTranscribing?.();
        transcribeRecording(wav).then(
          (text) => {
            if (!aborted) handlers.onPause(text);
          },
          (error: Error) => {
            if (!aborted) handlers.onError?.(error.message);
          },
        );
      },
    },
    { endSilenceMs: pauseMs },
  ).then(
    (opened) => {
      if (stopped) return opened.close();
      mic = opened;
      handlers.onReady?.();
    },
    (error) => {
      if (stopped) return;
      close();
      handlers.onError?.(micErrorMessage(error));
    },
  );

  return {
    finish() {
      if (stopped) return;
      if (!mic || !heardSpeech) return finishEmpty();
      finishing = true;
      mic.flush();
    },
    abort() {
      aborted = true;
      close();
    },
  };
}

// Waits for the assistant's name without ever switching the microphone off
// in between: speech that isn't a call is simply dropped. Every guess the
// engine makes is checked, since an unusual name is rarely its first guess.
// `match` returns what followed the name, or null.
export function createWakeListener(
  lang: SpeechLang,
  match: (text: string) => string | null,
  handlers: { onWake: (rest: string) => void; onError: (message: string) => void },
  { pauseMs = 900 }: { pauseMs?: number } = {},
): { abort: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    handlers.onError("Voice isn't supported in this browser. Try Chrome, Edge or Safari.");
    return { abort: () => {} };
  }

  let rec: Recognition;
  let stopped = false;
  // Once the name is heard: what followed it so far, updated until a pause
  let rest: string | null = null;
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  const android = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  function close() {
    stopped = true;
    clearTimeout(pauseTimer);
    clearTimeout(restartTimer);
    try {
      rec.abort();
    } catch {
      // already stopped
    }
  }

  function fire() {
    if (stopped || rest === null) return;
    const said = rest;
    close();
    handlers.onWake(said);
  }

  function start() {
    rec = new Ctor!();
    rec.lang = lang;
    rec.continuous = !android;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    let from = 0; // results before this index were already dealt with

    rec.onresult = (event) => {
      if (rest === null) {
        // Look for the name in each new phrase, in every guess
        for (let i = from; i < event.results.length && rest === null; i++) {
          const r = event.results[i];
          for (let a = 0; a < r.length && rest === null; a++) {
            const found = match(r[a]?.transcript ?? "");
            if (found !== null) {
              from = i;
              rest = found;
            }
          }
          // A finished phrase without the name is forgotten
          if (rest === null && r.isFinal) from = i + 1;
        }
        if (rest === null) return;
      }
      // Keep following what's said after the name until they pause
      const named = event.results[from];
      let head: string | null = null;
      for (let a = 0; a < named.length && head === null; a++) head = match(named[a]?.transcript ?? "");
      const after: string[] = [];
      for (let i = from + 1; i < event.results.length; i++) after.push(event.results[i][0].transcript);
      if (head !== null) rest = join(head, ...after);
      clearTimeout(pauseTimer);
      pauseTimer = setTimeout(fire, pauseMs);
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      close();
      handlers.onError(SPEECH_ERRORS[event.error] ?? "Voice stopped. Try again.");
    };
    rec.onend = () => {
      if (stopped) return;
      if (rest !== null) return fire();
      // Sessions end on their own every so often; carry straight on
      restartTimer = setTimeout(start, 50);
    };
    try {
      rec.start();
    } catch {
      close();
      handlers.onError("Couldn't start the microphone. Try again.");
    }
  }

  start();
  return { abort: close };
}

// Hindi text is read with a Hindi voice even when the chosen language is English
const DEVANAGARI = /[\u{0900}-\u{097F}]/u;

// Money as a person would say it. The grouping commas in "₹1,23,456" make the
// engine read the digits one by one, so they go; lakh/crore only above 1 lakh,
// since the engine already says smaller numbers well ("8500" → eight thousand
// five hundred), and "8.5 thousand" would come out as "eight point five".
function spokenAmount(digits: string, hindi: boolean) {
  const n = Number(digits.replace(/,/g, ""));
  const [rupees, lakh, crore] = hindi ? ["रुपये", "लाख", "करोड़"] : ["rupees", "lakh", "crore"];
  if (!Number.isFinite(n)) return `${digits} ${rupees}`;
  const trim = (v: number) => Number(v.toFixed(2)).toString();
  if (n >= 1e7) return `${trim(n / 1e7)} ${crore} ${rupees}`;
  if (n >= 1e5) return `${trim(n / 1e5)} ${lakh} ${rupees}`;
  return `${n} ${rupees}`;
}

// Markdown → plain sentences that sound right when spoken.
// Sentence punctuation (. ? !) is deliberately kept: the speech engine uses it
// for pauses and intonation. Only the markup that gets vocalised is stripped.
export function speakable(markdown: string) {
  const hindi = DEVANAGARI.test(markdown);
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*\|?\s*:?-{2,}.*$/gm, " ")
    .replace(/\|/g, ", ")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/[*_`~>#]/g, "")
    .replace(/₹\s?([\d,]+)/g, (_, d: string) => spokenAmount(d, hindi))
    .replace(/(\d)\s*%/g, hindi ? "$1 प्रतिशत" : "$1 percent")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[–—→]/g, ", ")
    // "Label: value" is read as the word "colon" by some voices — make it a pause.
    // Colons between digits (10:30, 3:1) are left alone; voices read those fine.
    .replace(/\s*(?:(?<!\d):|:(?!\d))\s*/g, ", ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/([.!?])\s*,/g, "$1")
    .replace(/(,\s*){2,}/g, ", ")
    .replace(/(\.\s*){2,}/g, ". ")
    .replace(/^[\s,.]+/, "")
    .trim();
}

// Whole sentences: the voice falls or lifts at the end of each one. A sentence
// ends only at punctuation followed by a space, so "1.23 lakh" stays together.
// Very short ones ("Sure.") join the next, which also sounds more natural.
const SENTENCE = /.+?(?:[.!?।]+(?=\s|$)|$)/g;
const SHORTEST_SENTENCE = 25;
const LONGEST_TEXT = 1200;
// Fetch a little ahead so sentences run together, but not a whole long reply
// that may get interrupted
const FETCH_AHEAD = 3;

export function sentencesOf(text: string) {
  const out: string[] = [];
  let carry = "";
  for (const match of text.match(SENTENCE) ?? []) {
    carry = join(carry, match);
    if (carry.length >= SHORTEST_SENTENCE) {
      out.push(carry);
      carry = "";
    }
  }
  if (carry) out.push(carry);
  return out;
}

// Splits off the sentences that are complete in text still being written.
// Returns them with how many characters they used.
export function completeSentences(text: string) {
  const end = /[.!?।]+\s/g;
  let used = 0;
  let found = end.exec(text);
  while (found) {
    used = found.index + found[0].length;
    found = end.exec(text);
  }
  return { sentences: sentencesOf(text.slice(0, used)), used };
}

function pickVoice(lang: SpeechLang) {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.slice(0, 2);
  return (
    voices.find((v) => v.lang.replace("_", "-") === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    null
  );
}

// Voices load late in some browsers
function voicesReady() {
  if (window.speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => resolve();
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1000);
  });
}

// The device's own voice: used only when the real one can't be reached or
// the browser won't play it, so a reply is never lost.
async function deviceSay(text: string, lang: SpeechLang) {
  if (!("speechSynthesis" in window)) return;
  await voicesReady();
  const voiceLang: SpeechLang = DEVANAGARI.test(text) ? "hi-IN" : lang;
  const voice = pickVoice(voiceLang);
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voiceLang;
    if (voice) u.voice = voice;
    u.rate = 1.03;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// An empty WAV. Browsers only let a page play sound freely after a tap has
// started it, and this one element is what gets started.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
let audioElement: HTMLAudioElement | null = null;
let audioUnlocked = false;

function sharedAudio() {
  audioElement ??= new Audio();
  return audioElement;
}

/** Call during a tap, so replies can play later without one. */
export function unlockAudio() {
  if (audioUnlocked || typeof window === "undefined") return;
  audioUnlocked = true;
  const audio = sharedAudio();
  audio.src = SILENCE;
  void audio.play().catch(() => {
    audioUnlocked = false;
  });
}

async function fetchVoice(text: string) {
  try {
    const response = await fetch("/api/assistant/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, LONGEST_TEXT) }),
    });
    if (!response.ok) return null;
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}

export type Speaker = {
  /** Add a sentence to what's being said. */
  say: (text: string) => void;
  /** No more sentences are coming. */
  end: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Resolves when everything has been said, or on stop. */
  finished: Promise<void>;
};

// Says sentences in order as they arrive, fetching the audio ahead of time.
export function createSpeaker(
  lang: SpeechLang,
  { onStart }: { onStart?: () => void } = {},
): Speaker {
  type Line = { text: string; audio?: Promise<string | null> };
  const lines: Line[] = [];
  let ended = false;
  let stopped = false;
  let paused = false;
  let started = false;
  // Saying a line with the device's voice right now. Pausing that voice when
  // it's idle can leave it stuck, so it's only touched while it's in use.
  let onDevice = false;
  let wakeLoop: (() => void) | null = null;
  let endPlayback: (() => void) | null = null;

  const wake = () => {
    wakeLoop?.();
    wakeLoop = null;
  };
  const nextEvent = () =>
    new Promise<void>((resolve) => {
      wakeLoop = resolve;
    });

  const fetchAhead = () => {
    for (const line of lines.slice(0, FETCH_AHEAD)) line.audio ??= fetchVoice(line.text);
  };
  const release = (url: string | null | undefined) => {
    if (url) URL.revokeObjectURL(url);
  };

  function play(url: string) {
    const audio = sharedAudio();
    return new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        audio.onended = null;
        audio.onerror = null;
        endPlayback = null;
        resolve(ok);
      };
      endPlayback = () => done(true);
      audio.onended = () => done(true);
      audio.onerror = () => done(false);
      audio.src = url;
      audio.play().catch(() => done(false));
    });
  }

  async function run() {
    while (!stopped) {
      if (paused) {
        await nextEvent();
        continue;
      }
      const line = lines[0];
      if (!line) {
        if (ended) return;
        await nextEvent();
        continue;
      }
      fetchAhead();
      const url = await line.audio;
      // Paused or stopped while the audio was on its way
      if (stopped) {
        release(url);
        break;
      }
      if (paused) {
        line.audio = Promise.resolve(url ?? null);
        continue;
      }
      lines.shift();
      fetchAhead();
      if (!started) {
        started = true;
        onStart?.();
      }
      const played = url ? await play(url) : false;
      release(url);
      if (!played && !stopped) {
        onDevice = true;
        await deviceSay(line.text, lang);
        onDevice = false;
      }
    }
    for (const line of lines) void line.audio?.then(release);
  }

  const finished = run();

  return {
    say(text) {
      const line = text.trim();
      if (!line || stopped) return;
      lines.push({ text: line });
      wake();
    },
    end() {
      ended = true;
      wake();
    },
    pause() {
      paused = true;
      if (audioElement && endPlayback) audioElement.pause();
      if (onDevice) window.speechSynthesis.pause();
    },
    resume() {
      paused = false;
      if (audioElement && endPlayback) void audioElement.play().catch(() => endPlayback?.());
      if (onDevice) window.speechSynthesis.resume();
      wake();
    },
    stop() {
      stopped = true;
      ended = true;
      if (audioElement && endPlayback) audioElement.pause();
      endPlayback?.();
      if (onDevice) {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      }
      wake();
    },
    finished,
  };
}

// Which message is being read aloud, for the speaker buttons.
let speakingKey: string | null = null;
const speakingListeners = new Set<() => void>();
function setSpeakingKey(key: string | null) {
  speakingKey = key;
  for (const listener of speakingListeners) listener();
}
export const speakingStore = {
  subscribe(listener: () => void) {
    speakingListeners.add(listener);
    return () => speakingListeners.delete(listener);
  },
  get: () => speakingKey,
};

let current: Speaker | null = null;

// Reads text aloud; resolves when finished or stopped.
export async function speak(text: string, lang: SpeechLang, key: string | null = null) {
  if (!canSpeak()) return;
  unlockAudio();
  stopSpeaking();
  setSpeakingKey(key);
  const speaker = createSpeaker(lang);
  current = speaker;
  for (const sentence of sentencesOf(speakable(text))) speaker.say(sentence);
  speaker.end();
  await speaker.finished;
  if (current === speaker) {
    current = null;
    setSpeakingKey(null);
  }
}

export function stopSpeaking() {
  current?.stop();
  current = null;
  setSpeakingKey(null);
}
