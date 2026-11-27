"use client";

/* eslint-disable @next/next/no-img-element -- previews, and photos served by /api/media to the signed-in person only */

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { saveBodyProfile } from "@/app/(dashboard)/health/actions";
import { logout } from "@/app/login/actions";
import { changePassword, updateProfile } from "@/app/(dashboard)/settings/actions";
import { Band, Card, CardGrid, CardHead, Field, inputClass, primaryButtonClass, quietButtonClass } from "@/components/ui/kit";
import { ACTIVITIES, GOALS, type BodyProfile } from "@/lib/fitness";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_BODY: BodyProfile = {
  sex: "male",
  age: null,
  height_cm: null,
  activity: "moderate",
  goal: "maintain",
  experience: "beginner",
  days_per_week: 4,
  equipment: "full_gym",
  session_minutes: 60,
};

function Status({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p
      role={message.ok ? "status" : "alert"}
      className={`text-sm ${message.ok ? "text-moss" : "text-red-700 dark:text-red-300"}`}
    >
      {message.text}
    </p>
  );
}

export default function ProfileForm({
  userId,
  email,
  fullName,
  avatarPath,
  avatarUrl,
  body,
}: {
  userId: string;
  email: string;
  fullName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  body: BodyProfile | null;
}) {
  return (
    <CardGrid>
      <AboutCard
        userId={userId}
        email={email}
        fullName={fullName}
        avatarPath={avatarPath}
        avatarUrl={avatarUrl}
      />
      <BodyCard body={body ?? DEFAULT_BODY} />
      <PasswordCard />
      <Band className="max-w-xs">
        <form action={logout}>
          <button type="submit" className={`${quietButtonClass} w-full text-red-700 dark:text-red-300`}>
            Sign out
          </button>
        </form>
      </Band>
    </CardGrid>
  );
}

function AboutCard({
  userId,
  email,
  fullName,
  avatarPath,
  avatarUrl,
}: {
  userId: string;
  email: string;
  fullName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(fullName);
  const [path, setPath] = useState(avatarPath);
  const [preview, setPreview] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return setMessage({ ok: false, text: "Use a JPG, PNG or WebP photo." });
    if (file.size > 3 * 1024 * 1024)
      return setMessage({ ok: false, text: "Photos can be up to 3 MB." });
    setUploading(true);
    setMessage(null);
    const ext = file.type.split("/")[1];
    const newPath = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await createClient()
      .storage.from("avatars")
      .upload(newPath, file, { contentType: file.type });
    setUploading(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setPath(newPath);
    setPreview(URL.createObjectURL(file));
  }

  function save() {
    startTransition(async () => {
      const result = await updateProfile({ fullName: name, avatarPath: path });
      setMessage(result.ok ? { ok: true, text: "Saved." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  const initial = (name || email).charAt(0).toUpperCase();

  return (
    <Card>
      <CardHead title="About you" />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Change photo"
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/10 font-bold tracking-tight text-3xl"
        >
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : initial}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white">
              Uploading…
            </span>
          )}
        </button>
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="text-sm font-semibold text-ember"
          >
            {preview ? "Change photo" : "Add photo"}
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => {
                setPath(null);
                setPreview(null);
              }}
              className="text-sm text-paper/65"
            >
              Remove photo
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            pickPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input value={email} readOnly className={`${inputClass} text-paper/65`} />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Status message={message} />
        <button
          type="button"
          onClick={save}
          disabled={pending || uploading}
          className={primaryButtonClass}
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </Card>
  );
}

function BodyCard({ body }: { body: BodyProfile }) {
  const [draft, setDraft] = useState(body);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<BodyProfile>) => setDraft({ ...draft, ...patch });
  const num = (value: string) => (value === "" ? null : Number(value));

  function save() {
    startTransition(async () => {
      const result = await saveBodyProfile({ profile: draft });
      setMessage(
        result.ok
          ? { ok: true, text: "Saved. BMI and calories use these now." }
          : { ok: false, text: result.error },
      );
    });
  }

  return (
    <Card>
      <CardHead title="Body details" href="/health/body" link="Body" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Sex">
          <select
            value={draft.sex}
            onChange={(e) => set({ sex: e.target.value as BodyProfile["sex"] })}
            className={inputClass}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Age">
          <input
            type="number"
            inputMode="numeric"
            min={12}
            max={100}
            value={draft.age ?? ""}
            onChange={(e) => set({ age: num(e.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label="Height (cm)">
          <input
            type="number"
            inputMode="decimal"
            min={100}
            max={250}
            value={draft.height_cm ?? ""}
            onChange={(e) => set({ height_cm: num(e.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label="Activity">
          <select
            value={draft.activity}
            onChange={(e) => set({ activity: e.target.value as BodyProfile["activity"] })}
            className={inputClass}
          >
            {ACTIVITIES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Goal">
          <select
            value={draft.goal}
            onChange={(e) => set({ goal: e.target.value as BodyProfile["goal"] })}
            className={inputClass}
          >
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Status message={message} />
        <button type="button" onClick={save} disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : "Save body details"}
        </button>
      </div>
    </Card>
  );
}

function PasswordCard() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (password !== confirm)
      return setMessage({ ok: false, text: "The two passwords don't match." });
    startTransition(async () => {
      const result = await changePassword(password);
      setMessage(
        result.ok ? { ok: true, text: "Password changed." } : { ok: false, text: result.error },
      );
      if (result.ok) {
        setPassword("");
        setConfirm("");
      }
    });
  }

  return (
    <Card>
      <CardHead title="Password" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New password" hint="At least 8 characters">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Type it again">
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Status message={message} />
        <button
          type="button"
          onClick={save}
          disabled={pending || !password}
          className={quietButtonClass}
        >
          {pending ? "Changing…" : "Change password"}
        </button>
      </div>
    </Card>
  );
}
