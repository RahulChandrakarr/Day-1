"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  connectYoutube,
  disconnectYoutube,
  type ConnectState,
} from "@/app/(dashboard)/settings/integrations/actions";
import { inputClass, primaryButtonClass, quietButtonClass } from "@/components/ui/kit";
import IntegrationCard, { type IntegrationStatus } from "./integration-card";

export type YoutubeConnection = {
  fromEnv: boolean;
  accountName: string | null;
  since: string | null;
  problem: string | null;
  keyRejected: boolean;
} | null;

export default function YoutubeCard({ connection }: { connection: YoutubeConnection }) {
  const on = Boolean(connection && !connection.problem);
  const status: IntegrationStatus = !connection
    ? { label: "Not set up", tone: "off" }
    : connection.problem
      ? { label: connection.keyRejected ? "Key stopped working" : "Can't reach YouTube", tone: "warn" }
      : { label: connection.fromEnv ? "On" : "Linked", tone: "on" };

  return (
    <IntegrationCard
      letter="Y"
      markClassName="bg-[#b3372e]/12 text-[#b3372e] dark:text-red-300"
      name="YouTube"
      description="Search and play videos on Watch, through YouTube’s official player. A Data API key is needed to search."
      status={status}
    >
      {on && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-paper/80">
            {connection?.fromEnv
              ? "A YouTube key is set on the server, so search is on for the whole app."
              : `Personal key saved${connection?.since ? ` since ${connection.since}` : ""}.`}
          </p>
          <Link href="/watch" className="self-start text-sm font-semibold text-ember hover:underline">
            Open Watch →
          </Link>
          {!connection?.fromEnv && <Disconnect />}
        </div>
      )}
      {(!connection || connection.problem) && <ConnectForm replacing={Boolean(connection)} />}
      {connection?.problem && connection.fromEnv && (
        <p role="alert" className="text-sm text-[#b3372e] dark:text-red-300">
          {connection.problem}
        </p>
      )}
    </IntegrationCard>
  );
}

function ConnectForm({ replacing }: { replacing: boolean }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(connectYoutube, {
    error: null,
  });

  return (
    <form action={action} className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-paper/80 marker:text-paper/55">
        <li>
          Open{" "}
          <a
            href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-ember hover:underline"
          >
            Google Cloud · YouTube Data API v3
          </a>{" "}
          and enable it on a project.
        </li>
        <li>Create an API key (Credentials → Create credentials → API key).</li>
        <li>Paste it below. Without a key you can still paste a YouTube link on Watch to play it.</li>
      </ol>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-paper/70">YouTube Data API key</span>
        <input
          name="key"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          minLength={20}
          maxLength={200}
          placeholder="AIza…"
          className={inputClass}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-[#b3372e] dark:text-red-300">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Checking with YouTube…" : replacing ? "Save new key" : "Connect"}
      </button>
    </form>
  );
}

function Disconnect() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming)
    return (
      <button type="button" onClick={() => setConfirming(true)} className={`${quietButtonClass} self-start`}>
        Disconnect
      </button>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-paper/80">Remove the saved key?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await disconnectYoutube();
            if (result.error) setError(result.error);
          })
        }
        className="h-10 rounded-full bg-[#b3372e] px-4 text-sm font-semibold text-white transition disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-10 rounded-full px-3 text-sm text-paper/70 hover:text-paper"
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-[#b3372e] dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
