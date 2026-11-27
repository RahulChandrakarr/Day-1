"use client";

import { useState, useTransition } from "react";
import {
  previewBankSms,
  rotateInboxToken,
} from "@/app/(dashboard)/settings/actions";
import { formatMoney, formatShortDate, type BankAccount } from "@/lib/finance";
import type { InboxItem } from "@/lib/finance-queries";
import { Rows, inputClass, quietButtonClass } from "@/components/ui/kit";

// Setting up the phone, and checking it worked.
export default function BankMessages({
  token: initialToken,
  accounts,
  recent,
}: {
  token: string | null;
  accounts: BankAccount[];
  recent: (InboxItem & { status: string })[];
}) {
  const [token, setToken] = useState(initialToken);
  const url = token ? `/api/inbox/sms?token=${token}` : "";
  const full = typeof window === "undefined" ? url : `${window.location.origin}${url}`;
  const untagged = accounts.filter((a) => !a.account_tail);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-bold tracking-tight text-2xl">Forward your bank SMS</h2>
          <p className="mt-1 text-sm text-paper/70">
            India has no way for a personal app to read your bank directly — the account
            aggregator system is only open to licensed companies. What works instead is the
            message your bank already sends you. Your phone forwards those here, and each one
            waits on the Daily page until you accept it.
          </p>
        </div>

        <CopyRow label="Your forwarding address" value={full} />

        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-paper/78">
          <li>
            Install <span className="text-paper">MacroDroid</span> from the Play Store on your
            Android phone.
          </li>
          <li>
            Add a macro with the trigger <span className="text-paper">SMS Received</span>, and
            set it to match only your bank&apos;s sender, such as{" "}
            <code className="text-paper">AXISBK</code> or <code className="text-paper">SBIINB</code>.
          </li>
          <li>
            Add the action <span className="text-paper">HTTP Request → POST</span>, paste the
            address above, choose content type{" "}
            <code className="text-paper">application/json</code>, and set the body to:
          </li>
        </ol>
        <CopyRow
          label="Request body"
          value={'{"sender": "[sms_sender]", "body": "[sms_message]"}'}
        />
        <p className="text-sm text-paper/70">
          Repeat the trigger for each bank. Keep the sender filter tight: messages that never
          match never leave your phone, so one-time passwords stay where they belong.
        </p>
      </section>

      {untagged.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold tracking-tight text-2xl">Tell the app which account is which</h2>
          <p className="text-sm text-paper/70">
            {untagged.map((a) => a.name).join(" and ")}{" "}
            {untagged.length === 1 ? "has" : "have"} no account digits saved, so a forwarded
            message can&apos;t tell which account it belongs to. Open Financial → Daily, edit the
            account and fill in the last 4 digits of its number.
          </p>
        </section>
      )}

      <Tester />

      <section className="flex flex-col gap-2">
        <h2 className="font-bold tracking-tight text-2xl">What has arrived</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-paper/70">
            Nothing yet. Once the macro is on, send yourself a small payment and it should show
            up here within seconds.
          </p>
        ) : (
          <Rows>
            {recent.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {item.amount === null ? (
                      <span className="text-paper/72">Couldn&apos;t read it</span>
                    ) : (
                      <>
                        {item.direction === "credit" ? "+" : "−"}
                        {formatMoney(item.amount)}
                        {item.merchant && ` · ${item.merchant}`}
                      </>
                    )}
                  </p>
                  <p className="truncate text-xs text-paper/60">
                    {item.sender ?? "unknown sender"} ·{" "}
                    {item.occurred_on ? formatShortDate(item.occurred_on) : "no date"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-paper/60">{item.status}</span>
              </li>
            ))}
          </Rows>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-bold tracking-tight text-2xl">If the address leaks</h2>
        <p className="text-sm text-paper/70">
          Anyone holding it could add messages to your waiting list. They couldn&apos;t read
          anything or change your money, but a new address stops the old one at once — you would
          then update the macro on your phone.
        </p>
        <RotateButton onDone={setToken} />
      </section>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-paper/70">{label}</span>
      <span className="flex items-center gap-2">
        <input readOnly value={value} className={`${inputClass} text-xs`} />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 text-[13px] font-medium text-ember"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </span>
    </label>
  );
}

// Paste a real message and see what would be recorded, before trusting it
function Tester() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof previewBankSms>> | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="font-bold tracking-tight text-2xl">Try a message</h2>
        <p className="mt-1 text-sm text-paper/70">
          Paste one of your bank&apos;s texts to see what it would record. Nothing is saved.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Dear Customer, INR 240.00 debited from A/c XX8723 on 02-10-26 to VPA chaiwala@okaxis (UPI Ref 777111222333). -Axis Bank"
        className={`${inputClass} h-auto py-2 text-sm`}
      />
      <button
        type="button"
        disabled={pending || !text.trim()}
        onClick={() => startTransition(async () => setResult(await previewBankSms(text)))}
        className={`${quietButtonClass} self-start`}
      >
        {pending ? "Reading…" : "Read it"}
      </button>
      {result &&
        (result.junk ? (
          <p className="text-sm text-paper/72">
            Treated as a one-time password or an advert, so it would be dropped and never stored.
          </p>
        ) : result.parsed === null ? (
          <p className="text-sm text-paper/72">
            Couldn&apos;t read this one. It would still be kept so you can enter it by hand — send
            it to me and I&apos;ll teach the parser this wording.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {[
              ["Amount", formatMoney(result.parsed.amount)],
              ["Direction", result.parsed.direction === "credit" ? "money in" : "money out"],
              ["Account ending", result.parsed.accountTail ?? "—"],
              ["Date", result.parsed.occurredOn ?? "—"],
              ["Paid to / from", result.parsed.merchant ?? "—"],
              ["Reference", result.parsed.reference ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="truncate text-xs text-paper/70">{label}</dt>
                <dd className="truncate font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ))}
    </section>
  );
}

function RotateButton({ onDone }: { onDone: (token: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Change the address? Forwarding stops until you update your phone.")) return;
          startTransition(async () => {
            const result = await rotateInboxToken();
            if (result.ok && result.token) onDone(result.token);
            else setError("error" in result ? result.error : "Couldn't change it.");
          });
        }}
        className={`${quietButtonClass} self-start`}
      >
        {pending ? "Changing…" : "Use a new address"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </>
  );
}
