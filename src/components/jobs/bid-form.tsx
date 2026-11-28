"use client";

import { useState, useTransition } from "react";
import { bidOnFreelancer } from "@/app/(dashboard)/jobs/actions";
import { inputClass, primaryButtonClass } from "@/components/ui/kit";
import type { JobListing } from "@/lib/jobs";

export default function BidForm({ listing }: { listing: JobListing }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const hint =
    listing.minBudget != null
      ? `Around ${listing.pay ?? listing.minBudget}`
      : listing.currency
        ? `In ${listing.currency}`
        : "Their currency";

  if (done) {
    return (
      <p className="text-sm text-moss">Bid sent on Freelancer. It&apos;s on your desk as Applied.</p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const amount = Number(new FormData(form).get("amount"));
        const days = Number(new FormData(form).get("days"));
        const proposal = String(new FormData(form).get("proposal") ?? "");
        setError(null);
        start(async () => {
          const result = await bidOnFreelancer({ listing, amount, days, proposal });
          if (result.ok) setDone(true);
          else setError(result.error);
        });
      }}
    >
      <p className="text-sm font-semibold">Bid on Freelancer</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-paper/70">Amount · {hint}</span>
          <input
            name="amount"
            type="number"
            min={1}
            step="0.01"
            required
            placeholder={listing.minBudget != null ? String(listing.minBudget) : "500"}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-paper/70">Days</span>
          <input name="days" type="number" min={1} max={365} required defaultValue={7} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-paper/70">Proposal</span>
        <textarea
          name="proposal"
          required
          minLength={40}
          maxLength={4000}
          rows={4}
          placeholder="Who you are, how you’d do this, and when you can start."
          className={`${inputClass} h-auto py-3`}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-[#b3372e] dark:text-red-300">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Sending bid…" : "Send bid"}
      </button>
    </form>
  );
}
