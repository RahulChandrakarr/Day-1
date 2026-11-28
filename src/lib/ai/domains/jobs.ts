import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { bidOnFreelancer, saveJob } from "@/app/(dashboard)/jobs/actions";
import { getIntegrationKey } from "@/lib/integrations/keys";
import { JOB_SOURCES, JOB_STATUSES, listingKey, SOURCE_LABEL } from "@/lib/jobs";
import { searchJobs } from "@/lib/jobs-fetch";
import { getSavedJobs } from "@/lib/jobs-queries";
import { changed, failed, type Domain } from "./common";

function compact(listings: Awaited<ReturnType<typeof searchJobs>>["listings"]) {
  return listings.slice(0, 12).map((j) => ({
    key: listingKey(j),
    source: SOURCE_LABEL[j.source],
    sourceId: j.sourceId,
    title: j.title,
    company: j.company,
    location: j.location,
    pay: j.pay,
    url: j.url,
    kind: j.kind,
    canBid: j.source === "freelancer",
  }));
}

export const jobs: Domain = {
  labels: {
    search_jobs: "Looking for openings…",
    list_saved_jobs: "Opening your job desk…",
    save_job: "Saving that opening…",
    bid_freelancer: "Sending the bid…",
  },
  prompt: `JOBS
- search_jobs for openings on Day One's job desk (Remote OK, Remotive, Arbeitnow, Jobicy, Himalayas; Freelancer and Upwork if linked; Adzuna if the server has a key). Prefer this over search_web for "find me jobs".
- List title, company, pay, source and the apply URL. Say which boards answered.
- You can save an opening, or mark it applied. You can bid on Freelancer only after they give amount, days and a proposal; never invent a bid.
- You cannot apply on Upwork, Fiverr, Naukri or PeoplePerHour. For those, give the URL and tell them to apply on the site.
- Fiverr and Naukri have no public apply API — don't pretend they do.`,
  tools: (ctx) => ({
    search_jobs: tool({
      description:
        "Search the job desk: public remote boards, Freelancer gigs if linked, Upwork if linked, Adzuna India if configured.",
      inputSchema: z.object({
        query: z.string().max(120).describe('Role or keywords, e.g. "React developer Bangalore"'),
      }),
      execute: async ({ query }) => {
        const [freelancer, upwork] = await Promise.all([
          getIntegrationKey(ctx.profile.id, "freelancer").catch(() => null),
          getIntegrationKey(ctx.profile.id, "upwork").catch(() => null),
        ]);
        const result = await searchJobs(query, {
          freelancer: freelancer?.secret,
          upwork: upwork?.secret,
        });
        return {
          query: result.query,
          count: result.listings.length,
          sources: result.sources,
          freelancerLinked: Boolean(freelancer),
          upworkLinked: Boolean(upwork),
          openings: compact(result.listings),
        };
      },
    }),
    list_saved_jobs: tool({
      description: "List openings already on the person's Jobs desk (saved, applied, interview, won, passed).",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await getSavedJobs();
        return {
          count: rows.length,
          items: rows.slice(0, 20).map((r) => ({
            id: r.id,
            source: SOURCE_LABEL[r.source],
            title: r.title,
            company: r.company,
            status: r.status,
            url: r.url,
            pay: r.pay,
          })),
        };
      },
    }),
    save_job: tool({
      description:
        "Save an opening from search_jobs onto the Jobs desk, or mark it applied. Pass the fields from search_jobs.",
      inputSchema: z.object({
        source: z.enum(JOB_SOURCES),
        sourceId: z.string().min(1).max(200),
        title: z.string().min(1).max(200),
        company: z.string().max(120).optional(),
        url: z.string().url(),
        location: z.string().max(160).optional(),
        pay: z.string().max(80).optional(),
        summary: z.string().max(280).optional(),
        status: z.enum(JOB_STATUSES).default("saved"),
      }),
      execute: async (input) => {
        const result = await saveJob(
          {
            source: input.source,
            sourceId: input.sourceId,
            title: input.title,
            company: input.company ?? "",
            url: input.url,
            location: input.location ?? "",
            pay: input.pay ?? null,
            summary: input.summary ?? "",
            tags: [],
            postedAt: null,
            kind: input.source === "freelancer" || input.source === "upwork" ? "gig" : "job",
            currency: null,
            minBudget: null,
            maxBudget: null,
          },
          input.status,
        );
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Saved “${input.title}” as ${input.status}.`);
      },
    }),
    bid_freelancer: tool({
      description:
        "Place a bid on a Freelancer.com project from search_jobs. Only after the user gave amount, days and proposal text.",
      inputSchema: z.object({
        sourceId: z.string().min(1).max(200),
        title: z.string().min(1).max(200),
        url: z.string().url(),
        amount: z.number().positive(),
        days: z.number().int().min(1).max(365),
        proposal: z.string().min(40).max(4000),
        pay: z.string().max(80).optional(),
        summary: z.string().max(280).optional(),
      }),
      execute: async (input) => {
        const result = await bidOnFreelancer({
          listing: {
            source: "freelancer",
            sourceId: input.sourceId,
            title: input.title,
            company: "Client on Freelancer",
            url: input.url,
            location: "Remote",
            pay: input.pay ?? null,
            summary: input.summary ?? "",
            tags: [],
            postedAt: null,
            kind: "gig",
            currency: null,
            minBudget: null,
            maxBudget: null,
          },
          amount: input.amount,
          days: input.days,
          proposal: input.proposal,
        });
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Bid ${input.amount} on “${input.title}” for ${input.days} days.`);
      },
    }),
  }),
};
