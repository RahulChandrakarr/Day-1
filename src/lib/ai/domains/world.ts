import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { lookupLyrics, searchWeb } from "@/lib/ai/world";
import type { Domain } from "./common";

export const world: Domain = {
  labels: {
    search_web: "Looking it up…",
    lookup_lyrics: "Finding the lyrics…",
  },
  prompt: `WORLD
- You can chat about anything, look things up outside the app, and sing.
- search_web for news, people, weather, sports, how-tos, meanings, and any fact that is not in the app. Use it instead of guessing.
- lookup_lyrics when they ask you to sing or want the words of a song. If they didn't name one, pick a well-known Hindi song and look that up. Then SING: one short spoken lead-in with the title, then 8–16 lines of lyrics in the song's language, one line per line, no commentary between lines. If lookup fails, sing a verse you actually know rather than refusing.
- You sing with your own voice. You cannot play Spotify, YouTube or the original recording — don't offer to connect them.
- Never say you only track tasks, habits or money. That is only part of what you do.`,
  tools: () => ({
    search_web: tool({
      description:
        "Look up current facts outside the app: news, people, weather, sports, meanings, how-tos. Use this instead of guessing.",
      inputSchema: z.object({
        query: z.string().min(2).max(200).describe("What to look up, in the user's language"),
      }),
      execute: async ({ query }) => searchWeb(query),
    }),
    lookup_lyrics: tool({
      description:
        "Find the words of a song so you can sing them. Pass the song title, and the artist if you know it.",
      inputSchema: z.object({
        query: z.string().min(2).max(120).describe('Song title, e.g. "Kesariya" or "Kesariya Arijit Singh"'),
      }),
      execute: async ({ query }) => lookupLyrics(query),
    }),
  }),
};
