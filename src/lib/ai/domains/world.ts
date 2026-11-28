import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { fetchPage, lookupLyrics, searchWeb } from "@/lib/ai/world";
import type { Domain } from "./common";

export const world: Domain = {
  labels: {
    search_web: "Looking it up…",
    fetch_page: "Opening the page…",
    lookup_lyrics: "Finding the lyrics…",
  },
  prompt: `WORLD
- You can chat about anything outside the app: news, research, jobs, articles, people, weather, sports, how-tos, and songs.
- search_web first for news, companies, people, and any fact that is not in the app. Use it instead of guessing. For job openings, prefer the jobs tools (search_jobs) when they are available; use search_web only for boards not on the desk or for job news.
- fetch_page when they give a URL, or after search when a specific article, job post or page needs reading. Then summarise what it actually says; quote short bits, don't invent.
- lookup_lyrics when they ask you to sing or want the words of a song. If they didn't name one, pick a well-known song and look that up. Then SING: one short spoken lead-in with the title, then 8–16 lines of lyrics in the song's language, one line per line, no commentary between lines. If lookup fails, sing a verse you actually know rather than refusing.
- You sing with your own voice. You cannot play Spotify or the original recording. For YouTube, use the Watch tools when they're available, or send them to Watch.
- Never say you only track tasks, habits or money. That is only part of what you do.`,
  tools: () => ({
    search_web: tool({
      description:
        "Search the live web for news, jobs, people, weather, sports, research, meanings, how-tos. Use this instead of guessing.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .max(300)
          .describe('What to search, e.g. "React developer jobs in Bangalore" or "today India news"'),
      }),
      execute: async ({ query }) => searchWeb(query),
    }),
    fetch_page: tool({
      description:
        "Read a public web page (article, job posting, docs, blog). Pass a full https URL from the user or from search_web.",
      inputSchema: z.object({
        url: z.string().url().describe("Full http(s) URL to open"),
      }),
      execute: async ({ url }) => fetchPage(url),
    }),
    lookup_lyrics: tool({
      description:
        "Find the words of a song so you can sing them. Pass the song title, and the artist if you know it.",
      inputSchema: z.object({
        query: z.string().min(2).max(120).describe('Song title, e.g. "Kesariya" or "Lose Yourself Eminem"'),
      }),
      execute: async ({ query }) => lookupLyrics(query),
    }),
  }),
};
