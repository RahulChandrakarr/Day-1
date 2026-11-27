"use client";

import { useState, useTransition } from "react";
import { acceptInboxItem, ignoreInboxItem } from "@/app/(dashboard)/financial/actions";
import { formatMoney, formatShortDate, type Category } from "@/lib/finance";
import type { InboxItem } from "@/lib/finance-queries";
import { Rows, inputClass } from "@/components/ui/kit";

// Bank messages forwarded from the phone. Each one is a suggestion until it's
// accepted — the amount and account are read from the message, the category is
// the one thing the bank can't tell us.
export default function InboxCard({
  items,
  categories,
  token,
}: {
  items: InboxItem[];
  categories: Category[];
  token: string | null;
}) {
  const [setup, setSetup] = useState(false);
  // Only takes room when there is something to deal with; forwarding itself
  // is set up in Settings → Bank messages
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold tracking-tight text-2xl">
          From your bank
          <span className="ml-2 text-sm font-normal text-paper/60">
            {items.length} waiting
          </span>
        </h2>
        <button
          type="button"
          onClick={() => setSetup(!setup)}
          className="text-[13px] font-medium text-ember"
        >
          {setup ? "Hide setup" : "Set up forwarding"}
        </button>
      </div>

      {setup && <Setup token={token} />}

      <Rows>
        {items.map((item) => (
          <InboxRow key={item.id} item={item} categories={categories} />
        ))}
      </Rows>
    </section>
  );
}

function InboxRow({ item, categories }: { item: InboxItem; categories: Category[] }) {
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const readable = item.direction !== null && item.amount !== null;
  const forKind = categories.filter(
    (c) => c.type === (item.direction === "credit" ? "income" : "expense"),
  );

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Couldn't do that.");
    });

  return (
    // Phones: the message and its category on one line, the buttons under
    // them; one line once there is room
    <li
      className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1">
          {readable ? (
            <p className="truncate font-medium">
              <span className={item.direction === "credit" ? "text-moss" : ""}>
                {item.direction === "credit" ? "+" : "−"}
                {formatMoney(item.amount!)}
              </span>
              {item.merchant && <span className="text-paper/78"> · {item.merchant}</span>}
            </p>
          ) : (
            <p className="truncate font-medium text-paper/78">Couldn&apos;t read this one</p>
          )}
          <p className="truncate text-xs text-paper/60">
            {item.occurred_on ? formatShortDate(item.occurred_on) : "no date"}
            {item.sender && ` · ${item.sender}`}
            {!readable && ` · ${item.body.slice(0, 60)}`}
          </p>
          {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}
        </div>

        {readable && (
          <select
            aria-label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-10 w-36 shrink-0 rounded-inset border border-transparent bg-inset px-3 text-sm text-paper outline-none transition focus:border-ember/60 focus:ring-4 focus:ring-ember/10"
          >
            <option value="">No category</option>
            {forKind.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex shrink-0 gap-2 text-sm font-semibold">
        {readable && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => acceptInboxItem(item.id, categoryId || null))}
            className="h-10 flex-1 rounded-full bg-ember/15 px-4 text-ember transition hover:bg-ember/25 sm:flex-none"
          >
            Add it
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => ignoreInboxItem(item.id))}
          className="h-10 flex-1 rounded-full border border-paper/15 px-4 text-paper/70 transition hover:bg-paper/5 sm:flex-none"
        >
          Ignore
        </button>
      </div>
    </li>
  );
}

// What to put into the phone's automation app
function Setup({ token }: { token: string | null }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window === "undefined" || !token
      ? ""
      : `${window.location.origin}/api/inbox/sms?token=${token}`;

  return (
    <div className="flex flex-col gap-2 rounded-inset border border-paper/10 p-3 text-sm text-paper/78">
      <p>
        On Android, install MacroDroid or Tasker and make one rule: when an SMS arrives
        from your bank, POST it to this address with the message as{" "}
        <code className="text-paper">body</code> and the sender as{" "}
        <code className="text-paper">sender</code>.
      </p>
      <div className="flex items-center gap-2">
        <input readOnly value={url} className={`${inputClass} h-9 text-xs`} />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 text-[13px] font-medium text-ember"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-paper/60">
        Set the rule to match only your bank&apos;s senders, so one-time passwords and
        personal messages never leave the phone. Anyone with this address can add
        messages to your inbox, so keep it to yourself.
      </p>
    </div>
  );
}
