"use client";

import Link from "next/link";
import { useTransition } from "react";
import { saveMedia } from "@/app/(dashboard)/watch/actions";
import { Empty } from "@/components/ui/kit";
import type { YtVideo } from "@/lib/media";
import SaveBtn from "./save-btn";

export default function YoutubeGrid({
  videos,
  youtubeOn,
  query,
  savedKeys,
}: {
  videos: YtVideo[];
  youtubeOn: boolean;
  query: string;
  savedKeys: Set<string>;
}) {
  if (!youtubeOn) {
    return (
      <Empty href="/settings/integrations">
        Link a YouTube Data API key in Settings to search. You can still paste a video link above.
      </Empty>
    );
  }
  if (videos.length === 0) {
    return <Empty>{query ? `Nothing matched “${query}”.` : "YouTube didn’t return videos just now."}</Empty>;
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {videos.map((video) => (
        <li key={video.id}>
          <VideoTile video={video} saved={savedKeys.has(`youtube:${video.id}`)} />
        </li>
      ))}
    </ul>
  );
}

function VideoTile({ video, saved }: { video: YtVideo; saved: boolean }) {
  const [pending, start] = useTransition();
  return (
    <article className="card overflow-hidden">
      <Link href={`/watch?v=${video.id}`} className="block aspect-video bg-inset">
        {/* YouTube thumbs aren’t in next/image remotePatterns */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={video.thumb} alt="" className="h-full w-full object-cover" />
      </Link>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <Link href={`/watch?v=${video.id}`} className="line-clamp-2 text-sm font-bold leading-snug">
            {video.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-paper/65">{video.channel}</p>
        </div>
        <SaveBtn
          pending={pending}
          saved={saved}
          onSave={() =>
            start(async () => {
              await saveMedia({
                source: "youtube",
                sourceId: video.id,
                title: video.title,
                channel: video.channel,
                url: video.url,
                thumb: video.thumb,
              });
            })
          }
        />
      </div>
    </article>
  );
}
