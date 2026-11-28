"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  connectUpwork,
  disconnectUpwork,
  type ConnectState,
} from "@/app/(dashboard)/settings/integrations/actions";
import { inputClass, primaryButtonClass, quietButtonClass } from "@/components/ui/kit";
import IntegrationCard, { type IntegrationStatus } from "./integration-card";

export type UpworkConnection = {
  accountName: string | null;
  since: string;
  problem: string | null;
  keyRejected: boolean;
} | null;

export default function UpworkCard({ connection }: { connection: UpworkConnection }) {
  const status: IntegrationStatus = !connection
    ? { label: "Not linked", tone: "off" }
    : connection.problem
      ? { label: connection.keyRejected ? "Token stopped working" : "Can't reach Upwork", tone: "warn" }
      : { label: "Search only", tone: "on" };

  return (
    <IntegrationCard
      letter="U"
      markClassName="bg-moss/15 text-moss"
      name="Upwork"
      description="Search their job feed on Jobs if you have an approved GraphQL token. Upwork does not let apps send proposals."
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
            )}{" "}
            Search only — apply on Upwork itself.
          </p>
          {connection.problem && (
            <p role="alert" className="rounded-inset bg-[#b3372e]/10 px-3 py-2 text-sm text-[#b3372e] dark:text-red-300">
              {connection.problem}
            </p>
          )}
          {!connection.problem && (
            <Link href="/jobs" className="self-start text-sm font-semibold text-ember hover:underline">
              Open Jobs →
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
  const [state, action, pending] = useActionState<ConnectState, FormData>(connectUpwork, {
    error: null,
  });

  return (
    <form action={action} className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-paper/80 marker:text-paper/55">
        <li>
          You need an Upwork API app that already has GraphQL access (they approve this; it is not a personal
          password).
        </li>
        <li>
          From that app, copy an access token. Docs:{" "}
          <a
            href="https://www.upwork.com/developer/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-ember hover:underline"
          >
            upwork.com/developer
          </a>
          .
        </li>
        <li>Paste it below. Day One will only search jobs — never send a proposal.</li>
      </ol>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-paper/70">Upwork GraphQL access token</span>
        <input
          name="key"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          minLength={20}
          maxLength={500}
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
        {pending ? "Checking with Upwork…" : replacing ? "Save new token" : "Connect"}
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
            const result = await disconnectUpwork();
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
        className="h-10 rounded-full px-3 text-sm text-paper/70 transition hover:text-paper"
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
