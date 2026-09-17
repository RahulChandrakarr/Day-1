"use client";

// Browser speech: listen until the speaker pauses, and read text aloud.

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: { length: number; [i: number]: SpeechResult } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
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

export const canListen = () => recognitionCtor() !== null;
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

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

const join = (...parts: string[]) =>
  parts.map((p) => p.trim()).filter(Boolean).join(" ");

// Listens across the browser's short recognition sessions and hands over the
// whole utterance once the speaker has been quiet for `pauseMs`.
export function createListener(
  lang: SpeechLang,
  handlers: {
    onText?: (text: string) => void;
    onPause: (text: string) => void;
    onError?: (message: string) => void;
    onIdle?: () => void;
  },
  { pauseMs = 1600, idleMs = 25_000 }: { pauseMs?: number; idleMs?: number } = {},
): Listener {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    handlers.onError?.("Voice isn't supported in this browser. Try Chrome, Edge or Safari.");
    return { finish: () => {}, abort: () => {} };
  }

  let rec: Recognition;
  let stopped = false;
  let committed = ""; // text from sessions that already ended
  let sessionFinal = "";
  let current = "";
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;
  const idleTimer = setTimeout(() => {
    if (current) return;
    close();
    handlers.onIdle?.();
  }, idleMs);

  // Chrome on Android repeats phrases in continuous mode; one phrase per session there
  const android = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  function close() {
    stopped = true;
    clearTimeout(pauseTimer);
    clearTimeout(idleTimer);
    try {
      rec.abort();
    } catch {
      // already stopped
    }
  }

  function finish() {
    if (stopped) return;
    const text = current.trim();
    close();
    handlers.onPause(text);
  }

  function start() {
    rec = new Ctor!();
    rec.lang = lang;
    rec.continuous = !android;
    rec.interimResults = true;
    sessionFinal = "";

    rec.onresult = (event) => {
      let finals = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finals = join(finals, r[0].transcript);
        else interim = join(interim, r[0].transcript);
      }
      sessionFinal = finals;
      current = join(committed, finals, interim);
      handlers.onText?.(current);
      clearTimeout(pauseTimer);
      if (current) pauseTimer = setTimeout(finish, pauseMs);
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      close();
      handlers.onError?.(SPEECH_ERRORS[event.error] ?? "Voice stopped. Try again.");
    };
    rec.onend = () => {
      if (stopped) return;
      // Keep what this session heard (unless it only repeats earlier text)
      if (sessionFinal && !committed.endsWith(sessionFinal)) committed = join(committed, sessionFinal);
      current = committed;
      start();
    };
    try {
      rec.start();
    } catch {
      close();
      handlers.onError?.("Couldn't start the microphone. Try again.");
    }
  }

  start();
  return { finish, abort: close };
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

let speakToken = 0;

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

// Reads text aloud; resolves when finished or stopped.
export async function speak(text: string, lang: SpeechLang, key: string | null = null) {
  if (!canSpeak()) return;
  const token = ++speakToken;
  setSpeakingKey(key);
  try {
    await speakChunks(text, lang, token);
  } finally {
    if (token === speakToken) setSpeakingKey(null);
  }
}

async function speakChunks(text: string, lang: SpeechLang, token: number) {
  window.speechSynthesis.cancel();
  await voicesReady();
  if (token !== speakToken) return;
  const voiceLang: SpeechLang = DEVANAGARI.test(text) ? "hi-IN" : lang;
  const voice = pickVoice(voiceLang);
  // Whole sentences: short utterances avoid Chrome's cut-off, and keeping the
  // trailing punctuation lets the voice fall or lift at the end of each one.
  // A sentence ends only at punctuation followed by a space, so "1.23 lakh"
  // and "12.5 percent" aren't split into two utterances mid-number.
  const chunks = speakable(text).match(/.+?(?:[.!?।]+(?=\s|$)|$)/g) ?? [];
  for (const chunk of chunks) {
    if (token !== speakToken) return;
    const line = chunk.trim();
    if (!line) continue;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(line);
      u.lang = voiceLang;
      if (voice) u.voice = voice;
      u.rate = 1.03;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }
}

export function stopSpeaking() {
  speakToken++;
  setSpeakingKey(null);
  if (canSpeak()) window.speechSynthesis.cancel();
}
