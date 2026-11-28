"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { placeFreelancerBid } from "@/lib/freelancer";
import { getIntegrationKey } from "@/lib/integrations/keys";
import { JOB_SOURCES, JOB_STATUSES, type JobListing, type JobStatus } from "@/lib/jobs";
import { deleteJobSave, setJobSaveNotes, setJobSaveStatus, upsertJobSave } from "@/lib/jobs-queries";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/jobs");
}

function asListing(raw: unknown): JobListing | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!JOB_SOURCES.includes(r.source as JobListing["source"])) return null;
  const title = String(r.title ?? "").trim();
  const url = String(r.url ?? "").trim();
  const sourceId = String(r.sourceId ?? "").trim();
  if (!title || !sourceId || !/^https?:\/\//i.test(url)) return null;
  return {
    source: r.source as JobListing["source"],
    sourceId: sourceId.slice(0, 200),
    title: title.slice(0, 200),
    company: String(r.company ?? "").slice(0, 120),
    url: url.slice(0, 500),
    location: String(r.location ?? "Remote").slice(0, 160),
    pay: r.pay ? String(r.pay).slice(0, 80) : null,
    summary: String(r.summary ?? "").slice(0, 280),
    tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t).slice(0, 40)).slice(0, 8) : [],
    postedAt: typeof r.postedAt === "string" ? r.postedAt : null,
    kind: r.kind === "gig" ? "gig" : "job",
    currency: typeof r.currency === "string" ? r.currency : null,
    minBudget: typeof r.minBudget === "number" ? r.minBudget : null,
    maxBudget: typeof r.maxBudget === "number" ? r.maxBudget : null,
  };
}

export async function saveJob(raw: unknown, status: JobStatus = "saved"): Promise<Result> {
  await requireProfile();
  const listing = asListing(raw);
  if (!listing) return { ok: false, error: "That opening couldn't be saved." };
  if (!JOB_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  try {
    await upsertJobSave(listing, status);
  } catch {
    return { ok: false, error: "Couldn't save that just now. Try again." };
  }
  refresh();
  return { ok: true };
}

export async function markJob(id: string, status: JobStatus): Promise<Result> {
  await requireProfile();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Unknown opening." };
  if (!JOB_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  try {
    await setJobSaveStatus(id, status);
  } catch {
    return { ok: false, error: "Couldn't update that just now. Try again." };
  }
  refresh();
  return { ok: true };
}

export async function noteJob(id: string, notes: string): Promise<Result> {
  await requireProfile();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Unknown opening." };
  try {
    await setJobSaveNotes(id, notes);
  } catch {
    return { ok: false, error: "Couldn't save the note just now. Try again." };
  }
  refresh();
  return { ok: true };
}

export async function forgetJob(id: string): Promise<Result> {
  await requireProfile();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Unknown opening." };
  try {
    await deleteJobSave(id);
  } catch {
    return { ok: false, error: "Couldn't remove that just now. Try again." };
  }
  refresh();
  return { ok: true };
}

export async function bidOnFreelancer(input: {
  listing: unknown;
  amount: number;
  days: number;
  proposal: string;
}): Promise<Result> {
  const { profile } = await requireProfile();
  const listing = asListing(input.listing);
  if (!listing || listing.source !== "freelancer") {
    return { ok: false, error: "That isn't a Freelancer project." };
  }
  const amount = Number(input.amount);
  const days = Math.round(Number(input.days));
  const proposal = String(input.proposal ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return { ok: false, error: "Enter a bid amount." };
  }
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { ok: false, error: "Enter how many days the work will take, 1–365." };
  }
  if (proposal.length < 40) {
    return { ok: false, error: "Write a short proposal (at least a few sentences)." };
  }
  if (proposal.length > 4000) {
    return { ok: false, error: "That proposal is too long." };
  }

  let token;
  try {
    token = await getIntegrationKey(profile.id, "freelancer");
  } catch {
    return { ok: false, error: "Couldn't read your Freelancer link just now." };
  }
  if (!token) {
    return { ok: false, error: "Link Freelancer in Settings → Integrations first." };
  }

  const projectId = Number(listing.sourceId);
  if (!Number.isInteger(projectId)) return { ok: false, error: "That project id looks wrong." };

  const result = await placeFreelancerBid(token.secret, {
    projectId,
    amount,
    days,
    description: proposal,
  });
  if (!result.ok) return { ok: false, error: result.error };

  try {
    await upsertJobSave(
      listing,
      "applied",
      `Bid ${amount} for ${days} day${days === 1 ? "" : "s"}.\n\n${proposal}`,
    );
  } catch {
    // Bid already went through; the save is just our record.
  }
  refresh();
  return { ok: true };
}
