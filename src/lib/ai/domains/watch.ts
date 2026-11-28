import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { saveMedia } from "@/app/(dashboard)/watch/actions";
import { listInstagramMedia } from "@/lib/instagram";
import { getIntegrationKey } from "@/lib/integrations/keys";
import { parseYouTubeId, youtubeUrl } from "@/lib/media";
import { getSavedMedia } from "@/lib/media-queries";
import { searchYoutube, youtubeEnvKey, youtubeOEmbed } from "@/lib/youtube";
import { changed, failed, type Domain } from "./common";

async function youtubeKey(userId: string) {
  return youtubeEnvKey() ?? (await getIntegrationKey(userId, "youtube").catch(() => null))?.secret ?? null;
}

export const watch: Domain = {
  labels: {
    search_youtube: "Looking on YouTube…",
    list_instagram: "Opening Instagram…",
    list_saved_media: "Opening Watch…",
    save_video: "Saving that…",
  },
  prompt: `WATCH
- search_youtube for videos. List title, channel, and a Watch link as /watch?v=VIDEO_ID (Ask mode). Never invent video ids.
- You cannot play Spotify or download videos. Playback is YouTube’s official player on Watch.
- In talk mode, say the title and tell them to open Watch — never read a URL out loud.
- Instagram: list_instagram shows only the professional account they linked (their own posts). You cannot open someone else's profile, Explore, or Reels discovery. If they aren't linked, say so and point them to Settings → Integrations.
- save_video to put a YouTube result on their Watch desk.`,
  tools: (ctx) => ({
    search_youtube: tool({
      description:
        "Search YouTube for videos (needs a Data API key). Pass a topic, song, or a youtube.com / youtu.be URL.",
      inputSchema: z.object({
        query: z.string().min(2).max(200).describe('Search or a YouTube URL, e.g. "lofi beats" or a watch link'),
      }),
      execute: async ({ query }) => {
        const id = parseYouTubeId(query);
        if (id) {
          const video = await youtubeOEmbed(id);
          return { playing: video, watch: `/watch?v=${id}` };
        }
        const key = await youtubeKey(ctx.profile.id);
        if (!key) {
          return {
            error:
              "YouTube search needs a Data API key in Settings → Integrations. They can still paste a youtube.com link on Watch to play it.",
          };
        }
        const result = await searchYoutube(key, query);
        if (!result.ok) return failed(result.error);
        return {
          count: result.data.length,
          watch: `/watch?q=${encodeURIComponent(query)}`,
          videos: result.data.slice(0, 8).map((v) => ({
            id: v.id,
            title: v.title,
            channel: v.channel,
            watch: `/watch?v=${v.id}`,
            url: v.url,
          })),
        };
      },
    }),
    list_instagram: tool({
      description: "List posts from the linked Instagram professional account. Not other people's profiles.",
      inputSchema: z.object({}),
      execute: async () => {
        const key = await getIntegrationKey(ctx.profile.id, "instagram").catch(() => null);
        if (!key) {
          return {
            error:
              "Instagram isn't linked. They can connect a professional account in Settings → Integrations. Explore and other people's feeds are not available.",
          };
        }
        const result = await listInstagramMedia(key.secret);
        if (!result.ok) return failed(result.error);
        return {
          username: result.data.username,
          count: result.data.posts.length,
          posts: result.data.posts.slice(0, 12).map((p) => ({
            caption: p.caption,
            type: p.mediaType,
            url: p.permalink,
          })),
        };
      },
    }),
    list_saved_media: tool({
      description: "List YouTube videos and Instagram posts already saved on Watch.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await getSavedMedia();
        return {
          count: rows.length,
          items: rows.slice(0, 20).map((r) => ({
            source: r.source,
            title: r.title,
            channel: r.channel,
            url: r.source === "youtube" ? `/watch?v=${r.source_id}` : r.url,
            status: r.status,
          })),
        };
      },
    }),
    save_video: tool({
      description: "Save a YouTube video from search_youtube onto Watch.",
      inputSchema: z.object({
        id: z.string().min(11).max(11),
        title: z.string().min(1).max(200),
        channel: z.string().max(120).optional(),
      }),
      execute: async ({ id, title, channel }) => {
        if (!/^[\w-]{11}$/.test(id)) return failed("That isn't a YouTube video id.");
        const result = await saveMedia({
          source: "youtube",
          sourceId: id,
          title,
          channel,
          url: youtubeUrl(id),
        });
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Saved “${title}” to Watch.`);
      },
    }),
  }),
};
