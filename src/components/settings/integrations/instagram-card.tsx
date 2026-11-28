"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  connectInstagram,
  disconnectInstagram,
  type ConnectState,
} from "@/app/(dashboard)/settings/integrations/actions";
import { inputClass, primaryButtonClass, quietButtonClass } from "@/components/ui/kit";
import IntegrationCard, { type IntegrationStatus } from "./integration-card";

export type InstagramConnection = {
  accountName: string | null;
  since: string;
  problem: string | null;
  keyRejected: boolean;
} | null;

export default function InstagramCard({ connection }: { connection: InstagramConnection }) {
  const status: IntegrationStatus = !connection
    ? { label: "Not linked", tone: "off" }
    : connection.problem
      ? { label: connection.keyRejected ? "Token stopped working" : "Can't reach Instagram", tone: "warn" }
      : { label: "Your posts", tone: "on" };

  return (
    <IntegrationCard
      letter="I"
      markClassName="bg-ember/12 text-ember"
      name="Instagram"
      description="Your professional account’s posts on Watch. Instagram does not let apps show Explore, Reels discovery, or other people’s feeds."
      status={status}
    >
      {connection && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-paper/80">
            {connection.accountName ? (
              <>
                Linked as <span className="font-semibold">{connection.accountName}</span> since {connection.since}.
              </>
            ) : (
              <>Linked since {connection.since}.</>
            )}
          </p>
          {connection.problem && (
            <p role="alert" className="rounded-inset bg-[#b3372e]/10 px-3 py-2 text-sm text-[#b3372e] dark:text-red-300">
              {connection.problem}
            </p>
          )}
          {!connection.problem && (
            <Link href="/watch" className="self-start text-sm font-semibold text-ember hover:underline">
              Open Watch →
            </Link>
          )}
          <Disconnect />
        </div>
      )}
      {(!connection || connection.problem) && <ConnectForm replacing={Boolean(connection)} />}
    </IntegrationCard>
  );
}

function ConnectForm({ replacing }: { replacing: boolean }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(connectInstagram, {
    error: null,
  });

  return (
    <form action={action} className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-paper/80 marker:text-paper/55">
        <li>The account must be a professional Instagram account (Creator or Business), not a personal profile.</li>
        <li>
          In a Meta app, open{" "}
          <a
            href="https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-ember hover:underline"
          >
            Instagram API setup
          </a>
          , generate a token for that account, and copy it.
        </li>
        <li>Paste it below. Day One only reads your own posts.</li>
      </ol>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-paper/70">Instagram access token</span>
        <input
          name="key"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          minLength={20}
          maxLength={2000}
          placeholder="Paste the token here"
          className={inputClass}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-[#b3372e] dark:text-red-300">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Checking with Instagram…" : replacing ? "Save new token" : "Connect"}
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
      <span className="text-sm text-paper/80">Remove the saved token?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await disconnectInstagram();
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
