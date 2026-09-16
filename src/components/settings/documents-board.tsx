"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  addDocument,
  deleteDocument,
  documentLink,
  updateDocument,
} from "@/app/(dashboard)/settings/actions";
import Sheet from "@/components/ui/sheet";
import { Empty, Field, inputClass, primaryButtonClass } from "@/components/ui/kit";
import { formatShortDate } from "@/lib/finance";
import type { DocumentRow } from "@/lib/profile-queries";
import { createClient } from "@/lib/supabase/client";

const FOLDERS = ["ID", "Bills", "Insurance", "Receipts", "Medical", "Other"];
const ACCEPT = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_BYTES = 10 * 1024 * 1024;

const sizeText = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const iconFor = (mime: string) => (mime === "application/pdf" ? "📄" : mime.startsWith("image/") ? "🖼️" : "📎");

export default function DocumentsBoard({
  userId,
  documents,
}: {
  userId: string;
  documents: DocumentRow[];
}) {
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);

  const folders = useMemo(
    () => [...new Set([...FOLDERS, ...documents.map((d) => d.folder)])],
    [documents],
  );
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) map.set(d.folder, (map.get(d.folder) ?? 0) + 1);
    return map;
  }, [documents]);

  const q = query.trim().toLowerCase();
  const shown = documents.filter(
    (d) => (!folder || d.folder === folder) && (!q || d.name.toLowerCase().includes(q)),
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files"
          aria-label="Search files"
          className={`${inputClass} flex-1`}
        />
        <button
          type="button"
          onClick={() => setUploading(true)}
          className="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-ember px-4 text-[15px] font-semibold text-on-ember transition-colors hover:bg-ember-light"
        >
          <span className="text-lg leading-none">+</span> Upload
        </button>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {[null, ...folders].map((f) => {
          const active = folder === f;
          const count = f === null ? documents.length : (counts.get(f) ?? 0);
          return (
            <button
              key={f ?? "all"}
              type="button"
              onClick={() => setFolder(f)}
              className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition ${
                active
                  ? "bg-paper text-ink"
                  : "border border-paper/10 bg-surface text-paper/65"
              }`}
            >
              {f ?? "All"}
              {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <Empty>
          {documents.length === 0
            ? "No files yet. Upload IDs, bills, insurance or receipts to keep them in one place."
            : "No files match."}
        </Empty>
      ) : (
        <ul className="overflow-hidden rounded-[18px] border border-paper/10 bg-surface">
          {shown.map((doc) => (
            <DocumentItem key={doc.id} doc={doc} folders={folders} />
          ))}
        </ul>
      )}

      <UploadSheet
        open={uploading}
        onClose={() => setUploading(false)}
        userId={userId}
        folders={folders}
        startFolder={folder ?? "Other"}
      />
    </>
  );
}

function DocumentItem({ doc, folders }: { doc: DocumentRow; folders: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doc.name);
  const [folder, setFolder] = useState(doc.folder);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(download: boolean) {
    // Open the tab right away so the browser doesn't block it as a popup
    const tab = download ? null : window.open("", "_blank");
    startTransition(async () => {
      const result = await documentLink(doc.id, download);
      if (!result.ok) {
        tab?.close();
        return setError(result.error);
      }
      if (tab) tab.location.href = result.url;
      else window.location.href = result.url;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateDocument(doc.id, { name, folder });
      if (!result.ok) return setError(result.error);
      setEditing(false);
      setError(null);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Delete "${doc.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteDocument(doc.id);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <li className={`border-b border-paper/[0.06] px-4 py-3 last:border-0 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {iconFor(doc.mime)}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => open(false)}
            className="block max-w-full truncate text-left text-[15px] font-medium hover:text-ember"
          >
            {doc.name}
          </button>
          <p className="truncate text-xs text-paper/50">
            {doc.folder} · {sizeText(doc.size)} · {formatShortDate(doc.created_at.slice(0, 10))}
          </p>
        </div>
        <button
          type="button"
          onClick={() => open(true)}
          aria-label={`Download ${doc.name}`}
          title="Download"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-paper/60 transition hover:bg-paper/10 hover:text-paper"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label={`Edit ${doc.name}`}
          aria-expanded={editing}
          title="More"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-paper/60 transition hover:bg-paper/10 hover:text-paper"
        >
          ⋯
        </button>
      </div>

      {editing && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={name}
              maxLength={120}
              aria-label="File name"
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            <select
              value={folder}
              aria-label="Folder"
              onChange={(e) => setFolder(e.target.value)}
              className={`${inputClass} w-auto`}
            >
              {folders.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className="h-10 flex-1 rounded-xl bg-ember text-sm font-semibold text-on-ember">
              Save
            </button>
            <button type="button" onClick={remove} disabled={pending} className="h-10 flex-1 rounded-xl border border-paper/10 text-sm font-semibold text-red-700 dark:text-red-300">
              Delete
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </li>
  );
}

function UploadSheet({
  open,
  onClose,
  userId,
  folders,
  startFolder,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  folders: string[];
  startFolder: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [folder, setFolder] = useState(startFolder);
  const [newFolder, setNewFolder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setFile(null);
    setName("");
    setNewFolder("");
    setError(null);
    onClose();
  }

  function pick(picked: File | undefined) {
    if (!picked) return;
    if (!ACCEPT.includes(picked.type))
      return setError("Upload a PDF or a photo (JPG, PNG, WebP, HEIC).");
    if (picked.size > MAX_BYTES) return setError("Files can be up to 10 MB.");
    setError(null);
    setFile(picked);
    if (!name) setName(picked.name.replace(/\.[^.]+$/, ""));
  }

  async function upload() {
    if (!file) return setError("Pick a file first.");
    setBusy(true);
    setError(null);
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await createClient()
      .storage.from("documents")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setBusy(false);
      return setError(uploadError.message);
    }
    const result = await addDocument({
      name: name || file.name,
      folder: newFolder.trim() || folder,
      path,
      mime: file.type,
      size: file.size,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    reset();
  }

  return (
    <Sheet
      open={open}
      onClose={reset}
      title="Upload a file"
      footer={
        <button type="button" onClick={upload} disabled={busy || !file} className={primaryButtonClass}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-[18px] border border-dashed border-paper/20 px-4 py-5 text-center transition hover:border-ember/60"
        >
          <span className="text-3xl" aria-hidden>
            {file ? iconFor(file.type) : "⬆️"}
          </span>
          <span className="max-w-full truncate text-sm font-medium">
            {file ? file.name : "Choose a PDF or photo"}
          </span>
          <span className="text-xs text-paper/50">
            {file ? sizeText(file.size) : "Up to 10 MB"}
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <Field label="Name">
          <input
            value={name}
            maxLength={120}
            placeholder="e.g. Aadhaar card"
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-paper/55">Folder</span>
          <div className="flex flex-wrap gap-2">
            {folders.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFolder(f);
                  setNewFolder("");
                }}
                className={`h-9 rounded-full px-3 text-[13px] font-medium transition ${
                  folder === f && !newFolder
                    ? "bg-paper text-ink"
                    : "border border-paper/10 text-paper/65"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            value={newFolder}
            maxLength={40}
            placeholder="Or a new folder name"
            onChange={(e) => setNewFolder(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
