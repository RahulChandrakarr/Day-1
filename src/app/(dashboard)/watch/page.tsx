import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PageShell from "@/components/dashboard/page-shell";
import WatchDesk from "@/components/watch/watch-desk";
import { requireProfile } from "@/lib/auth";
import { APP_TIMEZONE, LOCALE } from "@/lib/finance";
import { listInstagramMedia } from "@/lib/instagram";
import { getIntegrationKey } from "@/lib/integrations/keys";
import { parseYouTubeId } from "@/lib/media";
import { getSavedMedia } from "@/lib/media-queries";
import { popularYoutube, searchYoutube, youtubeEnvKey, youtubeOEmbed } from "@/lib/youtube";

export const metadata: Metadata = {
  title: "Watch · Day One",
};

const sinceFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "short",
});

export default async function WatchPage({ searchParams }: PageProps<"/watch">) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const raw = String(params.q ?? "").trim().slice(0, 200);
  const fromQuery = parseYouTubeId(raw);
  const videoId = parseYouTubeId(String(params.v ?? "")) ?? fromQuery;
  const query = fromQuery ? "" : raw;

  if (fromQuery && !params.v) redirect(`/watch?v=${fromQuery}`);

  const [ytKeyRow, igKey] = await Promise.all([
    getIntegrationKey(profile.id, "youtube").catch(() => null),
    getIntegrationKey(profile.id, "instagram").catch(() => null),
  ]);
  const ytKey = youtubeEnvKey() ?? ytKeyRow?.secret ?? null;

  const [videos, playing, saved, instagram] = await Promise.all([
    ytKey
      ? (query ? searchYoutube(ytKey, query) : popularYoutube(ytKey)).then((r) => (r.ok ? r.data : []))
      : Promise.resolve([]),
    videoId ? youtubeOEmbed(videoId) : Promise.resolve(null),
    getSavedMedia().catch(() => []),
    igKey
      ? listInstagramMedia(igKey.secret).then((r) =>
          r.ok
            ? { username: r.data.username, posts: r.data.posts, problem: null as string | null }
            : { username: igKey.accountName, posts: [], problem: r.error },
        )
      : Promise.resolve(null),
  ]);

  return (
    <PageShell
      title="Watch"
      description="YouTube in the app. Instagram is your own professional posts, if you link it."
    >
      <WatchDesk
        query={query}
        playing={playing}
        videos={videos}
        youtubeOn={Boolean(ytKey)}
        saved={saved}
        instagram={
          instagram && igKey
            ? {
                username: instagram.username,
                posts: instagram.posts,
                problem: instagram.problem,
                since: sinceFormat.format(new Date(igKey.connectedAt)),
              }
            : null
        }
      />
    </PageShell>
  );
}
