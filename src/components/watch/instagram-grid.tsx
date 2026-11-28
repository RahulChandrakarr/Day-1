"use client";

import { useTransition } from "react";
import { saveMedia } from "@/app/(dashboard)/watch/actions";
import { Empty } from "@/components/ui/kit";
import type { IgPost } from "@/lib/media";
import SaveBtn from "./save-btn";

export type InstagramPanel = {
  username: string | null;
  posts: IgPost[];
  problem: string | null;
  since: string;
} | null;

export default function InstagramGrid({
  instagram,
  savedKeys,
}: {
  instagram: InstagramPanel;
  savedKeys: Set<string>;
}) {
  if (!instagram) {
    return (
      <Empty href="/settings/integrations">
        Instagram only shows posts from a professional account you connect. Personal Explore and other people’s
        profiles aren’t available through their API.
      </Empty>
    );
  }
  if (instagram.problem) {
    return <Empty href="/settings/integrations">{instagram.problem}</Empty>;
  }
  if (instagram.posts.length === 0) {
    return <Empty>No posts on @{instagram.username} yet.</Empty>;
  }
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {instagram.posts.map((post) => (
        <li key={post.id}>
          <IgTile post={post} saved={savedKeys.has(`instagram:${post.id}`)} />
        </li>
      ))}
    </ul>
  );
}

function IgTile({ post, saved }: { post: IgPost; saved: boolean }) {
  const [pending, start] = useTransition();
  const src = post.thumb ?? post.mediaUrl;
  return (
    <article className="card overflow-hidden">
      <a href={post.permalink} target="_blank" rel="noreferrer" className="block aspect-square bg-inset">
        {src ? (
          // Instagram media URLs expire and aren’t in next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-paper/50">Open on Instagram</span>
        )}
      </a>
      <div className="flex items-start gap-1 p-2">
        <p className="min-w-0 flex-1 line-clamp-2 text-[11px] text-paper/75">{post.caption}</p>
        <SaveBtn
          pending={pending}
          saved={saved}
          onSave={() =>
            start(async () => {
              await saveMedia({
                source: "instagram",
                sourceId: post.id,
                title: post.caption,
                url: post.permalink,
                thumb: src,
              });
            })
          }
        />
      </div>
    </article>
  );
}
