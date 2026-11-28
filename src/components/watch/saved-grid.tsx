"use client";

import Link from "next/link";
import { useTransition } from "react";
import { forgetMedia, markMedia } from "@/app/(dashboard)/watch/actions";
import { Empty } from "@/components/ui/kit";
import type { MediaSave } from "@/lib/media";

export default function SavedGrid({ saved }: { saved: MediaSave[] }) {
  if (saved.length === 0) {
    return <Empty>Save a YouTube video or an Instagram post and it lands here.</Empty>;
  }
  return (
    <ul className="card flex flex-col divide-y divide-paper/[0.06] overflow-hidden">
      {saved.map((row) => (
        <SavedRow key={row.id} row={row} />
      ))}
    </ul>
  );
}

function SavedRow({ row }: { row: MediaSave }) {
  const [pending, start] = useTransition();
  const href = row.source === "youtube" ? `/watch?v=${row.source_id}` : row.url;
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      {row.thumb && (
        <Link href={href} className="h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-inset">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.thumb} alt="" className="h-full w-full object-cover" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <Link href={href} className="line-clamp-2 text-sm font-bold">
          {row.title}
        </Link>
        <p className="text-xs text-paper/60">
          {row.source === "youtube" ? "YouTube" : "Instagram"}
          {row.channel ? ` · ${row.channel}` : ""}
          {row.status === "watched" ? " · Watched" : ""}
        </p>
      </div>
      {row.source === "youtube" && row.status !== "watched" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await markMedia(row.id, "watched");
            })
          }
          className="shrink-0 text-xs font-semibold text-paper/70 hover:text-paper"
        >
          Watched
        </button>
      )}
      <button
        type="button"
        disabled={pending}
          onClick={() =>
            start(async () => {
              await forgetMedia(row.id);
            })
          }
        className="shrink-0 text-xs font-semibold text-paper/70 hover:text-paper"
      >
        Remove
      </button>
    </li>
  );
}
