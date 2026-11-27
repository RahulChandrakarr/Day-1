"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  connectSplitwise,
  disconnectSplitwise,
  type ConnectState,
} from "@/app/(dashboard)/settings/integrations/actions";
import { inputClass, primaryButtonClass, quietButtonClass } from "@/components/ui/kit";
import IntegrationCard, { type IntegrationStatus } from "./integration-card";

// What the server found when the page opened. Never includes the key itself.
export type SplitwiseConnection = {
  accountName: string | null;
  since: string;
  problem: string | null;
  keyRejected: boolean;
} | null;

export default function SplitwiseCard({ connection }: { connection: SplitwiseConnection }) {
  const status: IntegrationStatus = !connection
    ? { label: "Not linked", tone: "off" }
    : connection.problem
      ? { label: connection.keyRejected ? "Key stopped working" : "Can't reach Splitwise", tone: "warn" }
      : { label: "Linked", tone: "on" };

  return (
    <IntegrationCard
      letter="S"
      markClassName="bg-[#1cc29f]/15 text-[#0f8f74]"
      name="Splitwise"
      description="See who owes you and whom you owe, on Financial → Borrow. Read-only: Day One never adds or changes anything on Splitwise."
      status={status}
    >
      {connection && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-paper/80">
            {connection.accountName ? (
              <>
                Linked to <span className="font-semibold">{connection.accountName}</span>
                &apos;s Splitwise since {connection.since}.
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
            <Link
              href="/financial/borrow"
              className="self-start text-sm font-semibold text-ember hover:underline"
            >
              See balances on Borrow →
            </Link>
          )}
          <Disconnect />
        </div>
      )}

      {(!connection || connection.keyRejected) && <ConnectForm replacing={Boolean(connection)} />}
    </IntegrationCard>
  );
}

function ConnectForm({ replacing }: { replacing: boolean }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(connectSplitwise, {
    error: null,
  });

  return (
    <form action={action} className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-paper/80 marker:text-paper/55">
        <li>
          Open{" "}
          <a
            href="https://secure.splitwise.com/apps"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-ember hover:underline"
          >
            secure.splitwise.com/apps
          </a>{" "}
          and sign in to Splitwise.
        </li>
        <li>
          Register a new app. Any name works, e.g. &ldquo;Day One&rdquo;. If it asks for a
          website or callback address, use this app&apos;s address.
        </li>
        <li>On the app&apos;s page, create an API key and copy it.</li>
        <li>Paste it below and tap {replacing ? "Save new key" : "Connect"}.</li>
      </ol>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-paper/70">Your Splitwise API key</span>
        <input
          name="key"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the key here"
          className={inputClass}
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-[#b3372e] dark:text-red-300">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Checking with Splitwise…" : replacing ? "Save new key" : "Connect"}
      </button>
      <p className="text-xs text-paper/65">
        The key is kept where only Day One&apos;s server can read it, and is used only to
        read your balances.
      </p>
    </form>
  );
}

function Disconnect() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming)
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`${quietButtonClass} self-start`}
      >
        Disconnect
      </button>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-paper/80">Remove the saved key? You can paste it again later.</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await disconnectSplitwise();
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
