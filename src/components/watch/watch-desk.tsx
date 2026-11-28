"use client";

import { useState } from "react";
import { DarkCard, inputClass } from "@/components/ui/kit";
import type { MediaSave, YtVideo } from "@/lib/media";
import InstagramGrid, { type InstagramPanel } from "./instagram-grid";
import SavedGrid from "./saved-grid";
import VideoPlayer from "./video-player";
import YoutubeGrid from "./youtube-grid";

type Tab = "youtube" | "instagram" | "saved";

export default function WatchDesk({
  query,
  playing,
  videos,
  youtubeOn,
  saved,
  instagram,
}: {
  query: string;
  playing: YtVideo | null;
  videos: YtVideo[];
  youtubeOn: boolean;
  saved: MediaSave[];
  instagram: InstagramPanel;
}) {
  const [tab, setTab] = useState<Tab>("youtube");
  const savedKeys = new Set(saved.map((s) => `${s.source}:${s.source_id}`));

  return (
    <div className="flex flex-col gap-3">
      {playing && <VideoPlayer video={playing} />}

      <DarkCard>
        <form action="/watch" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="text-xs font-medium text-ink/70">YouTube search or link</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="A song, a tutorial, or a youtube.com link…"
              className={`${inputClass} mt-1 bg-paper/80 text-ink placeholder:text-ink/40`}
            />
          </label>
          <button
            type="submit"
            className="h-12 shrink-0 rounded-full bg-ember px-6 text-[15px] font-semibold text-on-ember"
          >
            {youtubeOn ? "Find videos" : "Open link"}
          </button>
        </form>
        <p className="mt-3 text-xs text-ink/65">
          {youtubeOn
            ? "Search uses the YouTube Data API. Playback is YouTube’s official player."
            : "Paste a YouTube link to watch it here. Add a Data API key in Settings → Integrations to search."}{" "}
          Instagram never shows other people’s feeds — only a professional account you connect.
        </p>
      </DarkCard>

      <div className="card flex gap-1 p-1">
        {(
          [
            { value: "youtube", label: "YouTube" },
            { value: "instagram", label: instagram?.username ? `@${instagram.username}` : "Instagram" },
            { value: "saved", label: `Saved · ${saved.length}` },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTab(opt.value)}
            className={`h-9 flex-1 rounded-xl px-3 text-sm font-semibold ${
              tab === opt.value ? "bg-ember text-on-ember" : "text-paper/70 hover:text-paper"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {tab === "youtube" && (
        <YoutubeGrid videos={videos} youtubeOn={youtubeOn} query={query} savedKeys={savedKeys} />
      )}
      {tab === "instagram" && <InstagramGrid instagram={instagram} savedKeys={savedKeys} />}
      {tab === "saved" && <SavedGrid saved={saved} />}
    </div>
  );
}
