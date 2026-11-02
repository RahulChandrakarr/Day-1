"use client";

import type * as Detector from "@ricky0123/vad-web";

// The microphone, with a small speech detector running on the device. It tells
// a voice from wind and traffic, keeps the moment just before speech so first
// words aren't clipped, and nothing leaves the device until someone has spoken.

// Copied here from node_modules by scripts/copy-vad-assets.mjs
const ASSET_PATH = "/vad/";

const CONFIRM_SPEECH_MS = 300;
const PAD_BEFORE_SPEECH_MS = 400;
// A recording this long still fits the upload limit (about 2 minutes 10 seconds)
const MAX_RECORDING_MS = 120_000;
const PCM_FORMAT = 1;
const SAMPLE_RATE = 16_000;
const SAMPLE_BITS = 16;

export type Mic = {
  /** End the recording in progress now, if there is one. */
  flush: () => void;
  /** The microphone is still connected and delivering sound. */
  isLive: () => boolean;
  /** Pick up again after the page was in the background. */
  wake: () => void;
  close: () => void;
};

export type MicHandlers = {
  /** Someone has been speaking long enough to be sure it's speech. */
  onSpeechStart?: () => void;
  /** A short sound that turned out not to be speech. */
  onMisfire?: () => void;
  onSpeechEnd: (wav: Blob) => void;
  /** The device stopped delivering sound, e.g. headphones were unplugged. */
  onLost?: () => void;
};

// Plain scripts rather than an import: this keeps the bundler away from the
// detector's own loading of its WebAssembly files. The second needs the first.
const SCRIPTS = ["ort.wasm.min.js", "bundle.min.js"];

function loadScript(file: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${ASSET_PATH}${file}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Couldn't load ${file}`));
    document.head.appendChild(script);
  });
}

let detector: Promise<typeof Detector> | null = null;

function loadDetector() {
  detector ??= (async () => {
    for (const file of SCRIPTS) await loadScript(file);
    return (window as unknown as { vad: typeof Detector }).vad;
  })().catch((error) => {
    detector = null; // a weak connection may do better next time
    throw error;
  });
  return detector;
}

export function canUseMic() {
  return (
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    "AudioWorkletNode" in window
  );
}

export async function openMic(
  handlers: MicHandlers,
  { endSilenceMs }: { endSilenceMs: number },
): Promise<Mic> {
  // Made before anything is awaited, so it still counts as part of the tap
  const context = new AudioContext();
  let stream: MediaStream | null = null;
  let vad: Detector.MicVAD | null = null;
  let closed = false;
  let recordingTimer: ReturnType<typeof setTimeout> | undefined;

  const releaseDevice = () => {
    stream?.getTracks().forEach((track) => track.stop());
    void context.close();
  };

  const getStream = async () => {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    stream.getAudioTracks()[0]?.addEventListener("ended", () => {
      if (!closed) handlers.onLost?.();
    });
    return stream;
  };

  async function flush() {
    if (!vad) return;
    // Pausing hands over what's been heard so far; starting again carries on
    await vad.pause();
    if (!closed) await vad.start();
  }

  try {
    const { MicVAD, utils } = await loadDetector();
    vad = await MicVAD.new({
      model: "v5",
      baseAssetPath: ASSET_PATH,
      onnxWASMBasePath: ASSET_PATH,
      ortConfig: (ort) => {
        ort.env.wasm.numThreads = 1;
      },
      audioContext: context,
      getStream,
      startOnLoad: false,
      // Stricter than the defaults (0.5 / 0.35), for outdoor noise
      positiveSpeechThreshold: 0.6,
      negativeSpeechThreshold: 0.4,
      redemptionMs: endSilenceMs,
      preSpeechPadMs: PAD_BEFORE_SPEECH_MS,
      minSpeechMs: CONFIRM_SPEECH_MS,
      submitUserSpeechOnPause: true,
      onSpeechRealStart: () => {
        clearTimeout(recordingTimer);
        recordingTimer = setTimeout(() => void flush(), MAX_RECORDING_MS);
        handlers.onSpeechStart?.();
      },
      onVADMisfire: () => handlers.onMisfire?.(),
      onSpeechEnd: (audio) => {
        clearTimeout(recordingTimer);
        const wav = utils.encodeWAV(audio, PCM_FORMAT, SAMPLE_RATE, 1, SAMPLE_BITS);
        handlers.onSpeechEnd(new Blob([wav], { type: "audio/wav" }));
      },
    });
    // In that order: without a tap, a browser only lets sound start once the
    // microphone is on, so waiting on it first could wait forever
    await vad.start();
    void context.resume();
  } catch (error) {
    closed = true;
    void vad?.destroy();
    releaseDevice();
    throw error;
  }

  return {
    flush: () => void flush(),
    isLive: () => stream?.getAudioTracks()[0]?.readyState === "live",
    wake: () => void context.resume(),
    close: () => {
      if (closed) return;
      closed = true;
      clearTimeout(recordingTimer);
      void Promise.resolve(vad?.destroy()).finally(releaseDevice);
    },
  };
}
