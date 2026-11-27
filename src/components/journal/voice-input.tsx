"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import Portal from "@/components/ui/portal";

// Minimal Web Speech API types (not in TypeScript's DOM lib)
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

const LANGUAGES = [
  { code: "en-IN", short: "EN", label: "English" },
  { code: "hi-IN", short: "हिं", label: "हिंदी" },
] as const;

type LangCode = (typeof LANGUAGES)[number]["code"];

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const errorText: Record<string, string> = {
  "not-allowed": "Allow microphone access to use voice typing.",
  "service-not-allowed": "Allow microphone access to use voice typing.",
  "no-speech": "Didn't hear anything. Tap the mic and try again.",
  "audio-capture": "No microphone found.",
  network: "Voice typing needs an internet connection.",
};

// The language picked last, shared by every mic in the app and kept on the device
const LANG_KEY = "voice-lang";
const langListeners = new Set<() => void>();
function readLang(): LangCode {
  try {
    return localStorage.getItem(LANG_KEY) === "hi-IN" ? "hi-IN" : "en-IN";
  } catch {
    return "en-IN";
  }
}
function writeLang(code: LangCode) {
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch {
    // private mode: the choice lasts until the page closes
  }
  langListeners.forEach((listener) => listener());
}
function subscribeLang(listener: () => void) {
  langListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    langListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// Words to add after what's already written, with one space between
export function joinSpoken(current: string, spoken: string) {
  return `${current}${current && !/\s$/.test(current) ? " " : ""}${spoken}`;
}

export type Dictation = ReturnType<typeof useDictation>;

// Speech to text. Finished phrases go to onText as they're recognised; the
// phrase still being heard is in `interim`.
export function useDictation(onText: (text: string) => void) {
  const lang = useSyncExternalStore(subscribeLang, readLang, () => "en-IN" as LangCode);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const wantListening = useRef(false);
  const lastWritten = useRef<{ text: string; at: number } | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  });

  // Stop the mic when leaving the page
  useEffect(
    () => () => {
      wantListening.current = false;
      recognition.current?.abort();
    },
    [],
  );

  function start(code: LangCode = lang) {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("Voice typing isn't supported in this browser. Try Chrome, Edge or Safari.");
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = code;
    // Chrome on Android repeats finished phrases in continuous mode, which
    // doubled the words. There we listen one phrase at a time and restart.
    const android = /Android/i.test(navigator.userAgent);
    rec.continuous = !android;
    rec.interimResults = true;

    // Each result is written once per session, and the same phrase arriving
    // again straight away is ignored.
    let written = new Set<number>();
    rec.onstart = () => {
      written = new Set<number>();
    };

    rec.onresult = (event) => {
      let pending = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (!result.isFinal) {
          if (i >= event.resultIndex) pending += `${text} `;
          continue;
        }
        if (written.has(i)) continue;
        written.add(i);
        const now = Date.now();
        const last = lastWritten.current;
        const recent = last && now - last.at < 5000;
        const said = text.toLowerCase();
        const before = last?.text.toLowerCase() ?? "";
        // Same phrase again: skip it
        if (recent && said === before) continue;
        // Longer phrase that repeats the last one: add only the new words
        const fresh =
          recent && said.startsWith(`${before} `) ? text.slice(before.length).trim() : text;
        lastWritten.current = { text, at: now };
        if (fresh) onTextRef.current(fresh);
      }
      setInterim(pending.trim());
    };
    rec.onerror = (event) => {
      if (event.error === "aborted") return;
      if (event.error !== "no-speech") wantListening.current = false;
      setError(errorText[event.error] ?? "Voice typing stopped. Try again.");
    };
    rec.onend = () => {
      setInterim("");
      // Browsers end the session after a pause; keep going until the user stops
      if (wantListening.current && recognition.current === rec) {
        try {
          rec.start();
          return;
        } catch {
          // fall through to stopped
        }
      }
      setListening(false);
    };

    recognition.current = rec;
    wantListening.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Couldn't start the microphone. Try again.");
    }
  }

  function stop() {
    wantListening.current = false;
    recognition.current?.stop();
    setListening(false);
    setInterim("");
  }

  function switchLang(code: LangCode) {
    writeLang(code);
    // Restart in the new language if already listening
    if (listening) {
      wantListening.current = false;
      recognition.current?.abort();
      recognition.current = null;
      start(code);
    }
  }

  const label = LANGUAGES.find((l) => l.code === lang)!.label;
  // One short line: the error, the words being heard, or that it's listening
  const status =
    error ??
    (listening
      ? interim
        ? `“${interim.length > 48 ? `…${interim.slice(-48)}` : interim}”`
        : `Listening in ${label}…`
      : null);

  return {
    lang,
    listening,
    interim,
    error,
    status,
    start,
    stop,
    toggle: () => (listening ? stop() : start()),
    switchLang,
  };
}

function LangSwitch({ d }: { d: Dictation }) {
  return (
    <div role="radiogroup" aria-label="Voice language" className="flex shrink-0 rounded-full card p-0.5 text-xs">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={d.lang === l.code}
          aria-label={l.label}
          title={l.label}
          onClick={() => d.switchLang(l.code)}
          className={`h-7 min-w-9 rounded-full px-2 font-medium transition-colors ${
            d.lang === l.code ? "bg-paper/10 text-paper" : "text-paper/60 hover:text-paper"
          }`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

const MicIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

const StopIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);

// The round mic. "quiet" is the small grey one that sits at the end of a text
// row; the default is the solid accent button.
export function MicButton({
  d,
  quiet = false,
  size = "md",
}: {
  d: Dictation;
  quiet?: boolean;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const idle = quiet
    ? "text-paper/60 hover:bg-paper/[0.07] hover:text-paper"
    : "bg-ember text-on-ember hover:bg-ember-light";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      // Keep the keyboard where it is: tapping the mic shouldn't move focus
      onMouseDown={(e) => e.preventDefault()}
      onClick={d.toggle}
      aria-pressed={d.listening}
      aria-label={d.listening ? "Stop voice typing" : "Speak to type"}
      title={d.listening ? "Stop" : "Speak to type"}
      className={`relative flex shrink-0 items-center justify-center rounded-full transition-colors ${box} ${
        d.listening ? "bg-red-500 text-white" : idle
      }`}
    >
      {d.listening && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />}
      {d.listening ? <StopIcon size={size === "lg" ? 16 : 14} /> : <MicIcon size={size === "lg" ? 22 : 18} />}
    </motion.button>
  );
}

// "Listening in English…" or the words being heard, with the language switch
// beside it, for a line under a text field while the mic is on.
export function DictationStatus({ d }: { d: Dictation }) {
  if (!d.status) return null;
  return (
    <div className="flex min-w-0 items-center gap-2 pt-1">
      <p
        role={d.error ? "alert" : "status"}
        className={`min-w-0 flex-1 truncate text-xs ${d.error ? "text-red-700 dark:text-red-300" : "text-paper/70"}`}
      >
        {d.status}
      </p>
      {d.listening && <LangSwitch d={d} />}
    </div>
  );
}

// Mic button + language switch for a text field; spoken words are passed to
// onText as they're recognised. The status line sits to the left of the
// buttons, on the same row, so turning the mic on never moves anything.
export default function VoiceInput({ onText }: { onText: (text: string) => void }) {
  const d = useDictation(onText);
  return (
    <div className="flex min-w-0 max-w-full items-center justify-end gap-1.5">
      {d.status && (
        <p
          role={d.error ? "alert" : "status"}
          className={`min-w-0 truncate rounded-full bg-glass-strong px-2.5 py-1 text-xs ${
            d.error ? "text-red-700 dark:text-red-300" : "text-paper/75"
          }`}
        >
          {d.status}
        </p>
      )}
      <LangSwitch d={d} />
      <MicButton d={d} />
    </div>
  );
}

// How much of the bottom of the window the on-screen keyboard covers, so
// something pinned to the bottom can sit just above it
function subscribeViewport(listener: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener("resize", listener);
  vv?.addEventListener("scroll", listener);
  return () => {
    vv?.removeEventListener("resize", listener);
    vv?.removeEventListener("scroll", listener);
  };
}
function keyboardCover() {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const covered = document.documentElement.clientHeight - vv.height - vv.offsetTop;
  // Small differences are browser bars sliding, not a keyboard
  return covered > 80 ? Math.round(covered) : 0;
}
export function useKeyboardCover() {
  return useSyncExternalStore(subscribeViewport, keyboardCover, () => 0);
}

// A mic that floats at the bottom right of the screen, above the phone's tab
// bar, or just above the keyboard while one is open. For long writing, where
// a mic inside the page would scroll away as the text grows.
export function VoiceDock({ onText }: { onText: (text: string) => void }) {
  const d = useDictation(onText);
  const cover = useKeyboardCover();
  return (
    <Portal>
      <div
        style={cover ? { bottom: cover + 12 } : undefined}
        className={`pointer-events-none fixed right-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-center justify-end gap-2 md:right-6 ${
          cover ? "" : "bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:bottom-6"
        }`}
      >
        {d.status && (
          <p
            role={d.error ? "alert" : "status"}
            className={`pointer-events-auto min-w-0 truncate rounded-full card glass-strong px-3.5 py-2 text-sm shadow-lg ${
              d.error ? "text-red-700 dark:text-red-300" : "text-paper/80"
            }`}
          >
            {d.status}
          </p>
        )}
        <div className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-full card glass-strong p-1 shadow-xl">
          <LangSwitch d={d} />
          <MicButton d={d} size="lg" />
        </div>
      </div>
    </Portal>
  );
}
