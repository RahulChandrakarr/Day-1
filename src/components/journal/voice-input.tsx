"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

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

// Mic button + language switch; spoken words are passed to onText as they're recognised.
export default function VoiceInput({
  onText,
}: {
  onText: (text: string) => void;
}) {
  const [lang, setLang] = useState<LangCode>("en-IN");
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

  function start(code: LangCode) {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError(
        "Voice typing isn't supported in this browser. Try Chrome, Edge or Safari.",
      );
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
          recent && said.startsWith(`${before} `)
            ? text.slice(before.length).trim()
            : text;
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
  }

  function switchLang(code: LangCode) {
    setLang(code);
    // Restart in the new language if already listening
    if (listening) {
      wantListening.current = false;
      recognition.current?.abort();
      recognition.current = null;
      start(code);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <div
          role="radiogroup"
          aria-label="Voice language"
          className="flex rounded-full card p-0.5 text-xs"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={lang === l.code}
              aria-label={l.label}
              title={l.label}
              onClick={() => switchLang(l.code)}
              className={`h-7 min-w-9 rounded-full px-2 font-medium transition-colors ${
                lang === l.code
                  ? "bg-paper/10 text-paper"
                  : "text-paper/45 hover:text-paper"
              }`}
            >
              {l.short}
            </button>
          ))}
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => (listening ? stop() : start(lang))}
          aria-pressed={listening}
          aria-label={listening ? "Stop voice typing" : "Start voice typing"}
          title={listening ? "Stop" : "Speak to type"}
          className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            listening
              ? "bg-red-500 text-white"
              : "bg-ember text-on-ember hover:bg-ember-light"
          }`}
        >
          {listening && (
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
          )}
          {listening ? (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
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
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {(listening || error) && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role={error ? "alert" : "status"}
            className={`max-w-full text-right text-xs ${
              error ? "text-red-700 dark:text-red-300" : "text-paper/55"
            }`}
          >
            {error ??
              (interim
                ? `“${interim}”`
                : `Listening in ${LANGUAGES.find((l) => l.code === lang)!.label}…`)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
