"use client";

import { useState, useTransition } from "react";
import { forgetJob, markJob, saveJob } from "@/app/(dashboard)/jobs/actions";
import { SOURCE_LABEL, statusLabel, type JobListing, type JobSave, type JobStatus } from "@/lib/jobs";
import BidForm from "./bid-form";

function ago(iso: string | null) {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return hours <= 1 ? "just in" : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function JobRow({
  listing,
  saved,
  canBid,
}: {
  listing: JobListing;
  saved: JobSave | null;
  canBid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const when = ago(listing.postedAt);

  function run(work: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const result = await work();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <article className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold uppercase tracking-wide text-paper/55">
            <span>{SOURCE_LABEL[listing.source]}</span>
            {listing.kind === "gig" && <span>Gig</span>}
            {when && <span>{when}</span>}
            {saved && (
              <span className="rounded-full bg-ember/15 px-2 py-0.5 text-[10px] text-ember">
                {statusLabel(saved.status)}
              </span>
            )}
          </p>
          <h3 className="mt-0.5 text-[16px] font-bold leading-snug tracking-[-0.015em]">{listing.title}</h3>
          <p className="mt-0.5 truncate text-sm text-paper/70">
            {listing.company}
            {listing.location ? ` · ${listing.location}` : ""}
            {listing.pay ? ` · ${listing.pay}` : ""}
          </p>
          {listing.summary && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-paper/75">{listing.summary}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1.5">
          <a
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              if (!saved && listing.source !== "freelancer") run(() => saveJob(listing, "applied"));
            }}
            className="rounded-full bg-ember px-3 py-1.5 text-center text-xs font-semibold text-on-ember"
          >
            {listing.source === "freelancer" && canBid ? "Open" : "Apply"}
          </a>
          {saved ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => forgetJob(saved.id))}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-paper/70 hover:text-paper"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => saveJob(listing))}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-paper/70 hover:text-paper"
            >
              Save
            </button>
          )}
          {(listing.summary || (listing.source === "freelancer" && canBid)) && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-ember"
            >
              {open ? "Close" : listing.source === "freelancer" && canBid ? "Bid" : "More"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-3 rounded-inset bg-inset px-3 py-3">
          {listing.tags.length > 0 && (
            <p className="flex flex-wrap gap-1">
              {listing.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-paper/10 px-2 py-0.5 text-[11px] text-paper/70">
                  {tag}
                </span>
              ))}
            </p>
          )}
          {saved && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-paper/70">On your desk</span>
              <select
                defaultValue={saved.status}
                disabled={pending}
                onChange={(e) => run(() => markJob(saved.id, e.target.value as JobStatus))}
                className="h-10 rounded-inset bg-surface px-3 text-sm"
              >
                {(["saved", "applied", "interview", "won", "passed"] as const).map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {listing.source === "freelancer" && canBid && saved?.status !== "applied" && (
            <BidForm listing={listing} />
          )}
          {listing.source === "upwork" && (
            <p className="text-xs text-paper/65">
              Upwork doesn&apos;t let apps send proposals. Open the job there to apply.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#b3372e] dark:text-red-300">
          {error}
        </p>
      )}
    </article>
  );
}
