"use client";
/* eslint-disable @next/next/no-img-element -- their own photo comes as a signed Storage URL that changes */

import Image from "next/image";
import { useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import sky from "../../../public/iccup-xNtwmcRP-gw-unsplash.jpg";
import {
  applyUploadedBackground,
  chooseBackground,
  removeBackgroundPhoto,
} from "@/app/(dashboard)/settings/appearance/actions";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "@/components/theme";
import { Card, CardHead, quietButtonClass } from "@/components/ui/kit";
import { GRADIENTS, type BackgroundChoice } from "@/lib/backgrounds";
import { createClient } from "@/lib/supabase/client";

const icon = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const THEMES: { id: ThemeChoice; label: string; hint: string; icon: ReactNode }[] = [
  {
    id: "system",
    label: "Match device",
    hint: "Light or dark with your phone or computer",
    icon: (
      <svg {...icon}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
  {
    id: "light",
    label: "Light",
    hint: "Always light",
    icon: (
      <svg {...icon}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    id: "dark",
    label: "Dark",
    hint: "Always dark",
    icon: (
      <svg {...icon}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    ),
  },
];

// Their own photos are shrunk on the phone before upload: a 12 MB camera shot
// becomes a few hundred KB, so the background loads fast everywhere
const MAX_EDGE = 2560;

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("shrink"))), "image/jpeg", 0.85),
  );
}

export default function AppearanceSettings({
  userId,
  background,
  photoUrl,
}: {
  userId: string;
  background: BackgroundChoice;
  // Their uploaded photo, if they have one (shown or not)
  photoUrl: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ThemeCard />
      <BackgroundCard userId={userId} background={background} photoUrl={photoUrl} />
    </div>
  );
}

function ThemeCard() {
  const choice = useThemeChoice();
  return (
    <Card>
      <CardHead title="Light or dark" />
      <div role="radiogroup" aria-label="Light or dark" className="grid gap-2 sm:grid-cols-3">
        {THEMES.map((t) => {
          const picked = choice === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={picked}
              onClick={() => setThemeChoice(t.id)}
              className={`flex items-center gap-3 rounded-inset border p-3 text-left transition ${
                picked
                  ? "border-ember/50 bg-surface/90 shadow-[0_6px_16px_-8px_rgb(120_90_70/0.4)] dark:bg-white/[0.12]"
                  : "border-paper/10 bg-inset hover:bg-paper/5"
              }`}
            >
              <span className={picked ? "text-ember" : "text-paper/70"}>{t.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="block text-xs text-paper/65">{t.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-paper/65">
        Kept on this device. Match device switches by itself when your device does, e.g. at
        sunset.
      </p>
    </Card>
  );
}

function BackgroundCard({
  userId,
  background,
  photoUrl,
}: {
  userId: string;
  background: BackgroundChoice;
  photoUrl: string | null;
}) {
  // Shows the tap at once; the real choice arrives when the app redraws
  const [shown, setShown] = useOptimistic(background);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(choice: BackgroundChoice) {
    if (choice === shown) return;
    setError(null);
    startTransition(async () => {
      setShown(choice);
      const result = await chooseBackground(choice);
      if (!result.ok) setError(result.error);
    });
  }

  async function upload(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Pick a photo (JPG, PNG, WebP or HEIC).");
    setError(null);
    setUploading(true);
    try {
      const blob = await shrink(file);
      const path = `${userId}/background-${Date.now()}.jpg`;
      const { error: uploadError } = await createClient()
        .storage.from("backgrounds")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) {
        setError("The photo didn't upload. Try again.");
        return;
      }
      startTransition(async () => {
        setShown("upload");
        const result = await applyUploadedBackground(path);
        if (!result.ok) setError(result.error);
      });
    } catch {
      setError("That photo couldn't be read. Try a JPG or PNG.");
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      if (shown === "upload") setShown("sky");
      const result = await removeBackgroundPhoto();
      if (!result.ok) setError(result.error);
    });
  }

  const busy = pending || uploading;

  return (
    <Card>
      <CardHead title="Background" aside="Behind every page, on all your devices" />
      <div
        role="radiogroup"
        aria-label="Background"
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
      >
        <Tile label="Sky" picked={shown === "sky"} onPick={() => pick("sky")} disabled={busy}>
          <Image src={sky} alt="" fill sizes="160px" placeholder="blur" className="object-cover" />
        </Tile>
        {GRADIENTS.map((g) => (
          <Tile key={g.id} label={g.label} picked={shown === g.id} onPick={() => pick(g.id)} disabled={busy}>
            <span className="absolute inset-0" style={{ background: g.css }} />
          </Tile>
        ))}
        {photoUrl ? (
          <Tile label="Your photo" picked={shown === "upload"} onPick={() => pick("upload")} disabled={busy}>
            <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </Tile>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-inset border border-dashed border-paper/25 bg-inset text-center text-xs font-semibold text-paper/75 transition hover:bg-paper/5 disabled:opacity-60"
          >
            <span className="text-xl" aria-hidden>
              +
            </span>
            {uploading ? "Uploading…" : "Your photo"}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />

      {photoUrl && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className={quietButtonClass}
          >
            {uploading ? "Uploading…" : "Change photo"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="flex min-h-11 items-center justify-center px-4 text-sm text-paper/70 transition hover:text-paper disabled:opacity-50"
          >
            Remove photo
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-[#b3372e] dark:text-red-300">
          {error}
        </p>
      )}
    </Card>
  );
}

function Tile({
  label,
  picked,
  onPick,
  disabled,
  children,
}: {
  label: string;
  picked: boolean;
  onPick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={picked}
      aria-label={label}
      onClick={onPick}
      disabled={disabled}
      className={`group relative aspect-[3/4] overflow-hidden rounded-inset border transition disabled:cursor-wait ${
        picked ? "border-ember ring-2 ring-ember/60" : "border-glass-edge hover:border-paper/30"
      }`}
    >
      {children}
      <span className="absolute inset-x-1.5 bottom-1.5 rounded-full bg-glass-strong px-2 py-1 text-center text-[11px] font-semibold text-paper backdrop-blur-md">
        {label}
      </span>
      {picked && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ember text-[11px] font-bold text-on-ember">
          ✓
        </span>
      )}
    </button>
  );
}
