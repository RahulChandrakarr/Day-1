// Shared job-desk types. Safe for server and client.

export const JOB_SOURCES = [
  "remoteok",
  "remotive",
  "arbeitnow",
  "jobicy",
  "himalayas",
  "freelancer",
  "adzuna",
  "upwork",
] as const;

export type JobSource = (typeof JOB_SOURCES)[number];

export const JOB_STATUSES = ["saved", "applied", "interview", "won", "passed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const SOURCE_LABEL: Record<JobSource, string> = {
  remoteok: "Remote OK",
  remotive: "Remotive",
  arbeitnow: "Arbeitnow",
  jobicy: "Jobicy",
  himalayas: "Himalayas",
  freelancer: "Freelancer",
  adzuna: "Adzuna",
  upwork: "Upwork",
};

export const SOURCE_HOME: Record<JobSource, string> = {
  remoteok: "https://remoteok.com",
  remotive: "https://remotive.com",
  arbeitnow: "https://www.arbeitnow.com",
  jobicy: "https://jobicy.com",
  himalayas: "https://himalayas.app",
  freelancer: "https://www.freelancer.com",
  adzuna: "https://www.adzuna.in",
  upwork: "https://www.upwork.com",
};

export type JobKind = "job" | "gig";

export type JobListing = {
  source: JobSource;
  sourceId: string;
  title: string;
  company: string;
  url: string;
  location: string;
  pay: string | null;
  summary: string;
  tags: string[];
  postedAt: string | null;
  kind: JobKind;
  currency: string | null;
  minBudget: number | null;
  maxBudget: number | null;
};

export type JobSave = {
  id: string;
  source: JobSource;
  source_id: string;
  title: string;
  company: string | null;
  url: string;
  location: string | null;
  pay: string | null;
  summary: string | null;
  status: JobStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type SourceState = "ok" | "off" | "fail";

export type JobSearch = {
  query: string;
  listings: JobListing[];
  sources: Partial<Record<JobSource, SourceState>>;
};

export function listingKey(listing: Pick<JobListing, "source" | "sourceId">) {
  return `${listing.source}:${listing.sourceId}`;
}

export function listingFromSave(row: JobSave): JobListing {
  return {
    source: row.source,
    sourceId: row.source_id,
    title: row.title,
    company: row.company ?? "",
    url: row.url,
    location: row.location ?? "",
    pay: row.pay,
    summary: row.summary ?? "",
    tags: [],
    postedAt: row.updated_at,
    kind: row.source === "freelancer" || row.source === "upwork" ? "gig" : "job",
    currency: null,
    minBudget: null,
    maxBudget: null,
  };
}

export function statusLabel(status: JobStatus) {
  return status === "passed" ? "Passed" : status[0].toUpperCase() + status.slice(1);
}

export function formatPay(min?: number | null, max?: number | null, currency?: string | null) {
  if (min == null && max == null) return null;
  const code = (currency ?? "").trim() || "USD";
  const one = (n: number) => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: code,
        maximumFractionDigits: n % 1 ? 2 : 0,
      }).format(n);
    } catch {
      return `${code} ${n}`;
    }
  };
  if (min != null && max != null && min !== max) return `${one(min)}–${one(max)}`;
  return one(min ?? max ?? 0);
}
