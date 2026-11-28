"use client";

import { useRef, useState } from "react";
import { addDocument } from "@/app/(dashboard)/settings/actions";
import { createClient } from "@/lib/supabase/client";
import { AttachIcon } from "./icons";

export const STUDY_FOLDER = "Study";
const ACCEPT = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_BYTES = 10 * 1024 * 1024;

function mimeOf(file: File) {
  if (ACCEPT.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return "";
}

export function uploadedStudyPrompt(name: string, extra = "") {
  const note = extra.trim();
  return `I've uploaded "${name}" into Study. It's a syllabus or study file. Read it, say what it covers, and use it for every question I ask from it.${note ? `\n\n${note}` : ""}`;
}

export async function saveStudyFile(file: File, userId: string) {
  const mime = mimeOf(file);
  if (!mime) {
    return { ok: false as const, error: "Upload a PDF or a photo (JPG, PNG, WebP, HEIC)." };
  }
  if (file.size > MAX_BYTES) return { ok: false as const, error: "Files can be up to 10 MB." };
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await createClient()
    .storage.from("documents")
    .upload(path, file, { contentType: mime });
  if (uploadError) return { ok: false as const, error: uploadError.message };
  const name = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 120) || file.name;
  const result = await addDocument({
    name,
    folder: STUDY_FOLDER,
    path,
    mime,
    size: file.size,
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, name };
}

export default function AttachFile({
  userId,
  disabled,
  onUploaded,
  onError,
}: {
  userId: string;
  disabled?: boolean;
  onUploaded: (name: string) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file || busy || disabled) return;
    setBusy(true);
    const result = await saveStudyFile(file, userId);
    setBusy(false);
    if (!result.ok) return onError(result.error);
    onUploaded(result.name);
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        aria-label={busy ? "Uploading file" : "Upload a syllabus or file"}
        title="Upload a syllabus or file"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-paper/70 transition hover:bg-paper/10 hover:text-paper disabled:opacity-50"
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <AttachIcon />
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}
