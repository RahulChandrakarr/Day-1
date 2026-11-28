"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DarkCard, Empty, inputClass } from "@/components/ui/kit";
import {
  listingFromSave,
  listingKey,
  type JobKind,
  type JobListing,
  type JobSave,
  type JobSource,
  type SourceState,
} from "@/lib/jobs";
import JobRow from "./job-row";
import { SourceChips, SourceNote, type BoardLink } from "./job-sources";

type Filter = "all" | JobKind;

export default function JobDesk({
  query,
  listings,
  sources,
  saved,
  freelancer,
  upwork,
  adzunaOn,
}: {
  query: string;
  listings: JobListing[];
  sources: Partial<Record<JobSource, SourceState>>;
  saved: JobSave[];
  freelancer: BoardLink;
  upwork: BoardLink;
  adzunaOn: boolean;
}) {
  const [tab, setTab] = useState<"open" | "saved">("open");
  const [kind, setKind] = useState<Filter>("all");
  const savedByKey = useMemo(() => {
    const map = new Map<string, JobSave>();
    for (const row of saved) map.set(`${row.source}:${row.source_id}`, row);
    return map;
  }, [saved]);

  const shown = listings.filter((item) => kind === "all" || item.kind === kind);
  const canBid = Boolean(freelancer && !freelancer.problem);

  return (
    <div className="flex flex-col gap-3">
      <DarkCard>
        <form action="/jobs" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="text-xs font-medium text-ink/70">Search</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="React, copywriting, Bangalore…"
              className={`${inputClass} mt-1 bg-paper/80 text-ink placeholder:text-ink/40`}
            />
          </label>
          <button
            type="submit"
            className="h-12 shrink-0 rounded-full bg-ember px-6 text-[15px] font-semibold text-on-ember"
          >
            Find openings
          </button>
        </form>
        <p className="mt-3 text-xs text-ink/65">
          Public boards are always on. Freelancer bids and Upwork search need a token in{" "}
          <Link href="/settings/integrations" className="font-semibold underline">
            Settings → Integrations
          </Link>
          .
        </p>
      </DarkCard>

      <SourceChips
        sources={sources}
        freelancer={freelancer}
        upwork={upwork}
        adzunaOn={adzunaOn}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segment
          value={tab}
          onChange={setTab}
          options={[
            { value: "open", label: `Openings${shown.length ? ` · ${shown.length}` : ""}` },
            { value: "saved", label: `Desk · ${saved.length}` },
          ]}
        />
        {tab === "open" && (
          <Segment
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All" },
              { value: "job", label: "Jobs" },
              { value: "gig", label: "Gigs" },
            ]}
          />
        )}
      </div>

      {tab === "open" ? (
        shown.length === 0 ? (
          <Empty>
            {query
              ? `Nothing matched “${query}”. Try a shorter role, or link Freelancer for gigs.`
              : "No openings came back just now. Try a search, or check again in a few minutes."}
          </Empty>
        ) : (
          <ul className="card divide-y divide-paper/[0.06] overflow-hidden">
            {shown.map((item) => (
              <li key={listingKey(item)}>
                <JobRow listing={item} saved={savedByKey.get(listingKey(item)) ?? null} canBid={canBid} />
              </li>
            ))}
          </ul>
        )
      ) : saved.length === 0 ? (
        <Empty>Save an opening to keep it here, or bid on Freelancer and it lands on this desk.</Empty>
      ) : (
        <ul className="card divide-y divide-paper/[0.06] overflow-hidden">
          {saved.map((row) => (
            <li key={row.id}>
              <JobRow listing={listingFromSave(row)} saved={row} canBid={canBid && row.source === "freelancer"} />
            </li>
          ))}
        </ul>
      )}

      <SourceNote />
    </div>
  );
}

function Segment<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="card flex gap-1 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`h-9 rounded-xl px-3 text-sm font-semibold ${
            value === opt.value ? "bg-ember text-on-ember" : "text-paper/70 hover:text-paper"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
