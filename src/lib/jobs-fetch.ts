import "server-only";
import { searchFreelancerProjects } from "./freelancer";
import {
  formatPay,
  type JobKind,
  type JobListing,
  type JobSearch,
  type JobSource,
  type SourceState,
} from "./jobs";
import { searchUpworkJobs } from "./upwork";

const UA = { "User-Agent": "DayOne/1.0 (personal job desk; +https://dayone.app)" };
const TIMEOUT = 8_000;
const PER_SOURCE = 12;
const MAX_LISTINGS = 48;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, max = 200) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function iso(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function listing(partial: {
  source: JobSource;
  sourceId: string;
  title: string;
  company?: string;
  url: string;
  location?: string;
  pay?: string | null;
  summary?: string;
  tags?: string[];
  postedAt?: string | null;
  kind?: JobKind;
  currency?: string | null;
  minBudget?: number | null;
  maxBudget?: number | null;
}): JobListing | null {
  const title = str(partial.title, 200);
  const url = str(partial.url, 500);
  const sourceId = str(partial.sourceId, 200);
  if (!title || !sourceId || !/^https?:\/\//i.test(url)) return null;
  return {
    source: partial.source,
    sourceId,
    title,
    company: str(partial.company, 120) || SOURCE_COMPANY[partial.source],
    url,
    location: str(partial.location, 160) || "Remote",
    pay: partial.pay?.slice(0, 80) ?? null,
    summary: str(partial.summary, 280),
    tags: (partial.tags ?? []).map((t) => str(t, 40)).filter(Boolean).slice(0, 8),
    postedAt: partial.postedAt ?? null,
    kind: partial.kind ?? (partial.source === "freelancer" || partial.source === "upwork" ? "gig" : "job"),
    currency: partial.currency ?? null,
    minBudget: partial.minBudget ?? null,
    maxBudget: partial.maxBudget ?? null,
  };
}

const SOURCE_COMPANY: Record<JobSource, string> = {
  remoteok: "Remote OK",
  remotive: "Remotive",
  arbeitnow: "Arbeitnow",
  jobicy: "Jobicy",
  himalayas: "Himalayas",
  freelancer: "Freelancer",
  adzuna: "Adzuna",
  upwork: "Upwork",
};

async function readJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...UA, ...init.headers },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<unknown>;
}

async function remoteok(query: string): Promise<JobListing[]> {
  const data = asList(await readJson("https://remoteok.com/api"));
  return data
    .slice(1)
    .map((row) => {
      const r = asRecord(row);
      if (!r) return null;
      const min = num(r.salary_min);
      const max = num(r.salary_max);
      return listing({
        source: "remoteok",
        sourceId: str(r.id || r.slug, 200),
        title: str(r.position || r.title),
        company: str(r.company),
        url: str(r.url || r.apply_url),
        location: str(r.location) || "Remote",
        pay: formatPay(min, max, "USD"),
        summary: str(r.description),
        tags: asList(r.tags).map((t) => str(t, 40)),
        postedAt: iso(r.date),
        currency: "USD",
        minBudget: min,
        maxBudget: max,
      });
    })
    .filter(matches(query))
    .slice(0, PER_SOURCE);
}

async function remotive(query: string): Promise<JobListing[]> {
  const params = new URLSearchParams({ limit: "50" });
  if (query) params.set("search", query.slice(0, 80));
  const data = asRecord(await readJson(`https://remotive.com/api/remote-jobs?${params}`));
  return asList(data?.jobs)
    .map((row) => {
      const r = asRecord(row);
      if (!r) return null;
      return listing({
        source: "remotive",
        sourceId: str(r.id, 200),
        title: str(r.title),
        company: str(r.company_name),
        url: str(r.url || r.job_url),
        location: str(r.candidate_required_location) || "Remote",
        pay: str(r.salary, 80) || null,
        summary: str(r.description),
        tags: asList(r.tags).map((t) => str(t, 40)),
        postedAt: iso(r.publication_date),
      });
    })
    .filter(matches(query))
    .slice(0, PER_SOURCE);
}

async function arbeitnow(query: string): Promise<JobListing[]> {
  const data = asRecord(await readJson("https://www.arbeitnow.com/api/job-board-api"));
  return asList(data?.data)
    .map((row) => {
      const r = asRecord(row);
      if (!r) return null;
      return listing({
        source: "arbeitnow",
        sourceId: str(r.slug, 200),
        title: str(r.title),
        company: str(r.company_name),
        url: str(r.url),
        location: r.remote ? "Remote" : str(r.location) || "Europe",
        summary: str(r.description),
        tags: asList(r.tags).map((t) => str(t, 40)),
        postedAt: iso(r.created_at),
      });
    })
    .filter(matches(query))
    .slice(0, PER_SOURCE);
}

async function jobicy(query: string): Promise<JobListing[]> {
  const params = new URLSearchParams({ count: "50" });
  if (query) params.set("tag", query.split(/\s+/)[0]!.slice(0, 40));
  const data = asRecord(await readJson(`https://jobicy.com/api/v2/remote-jobs?${params}`));
  return asList(data?.jobs)
    .map((row) => {
      const r = asRecord(row);
      if (!r) return null;
      const min = num(r.annualSalaryMin);
      const max = num(r.annualSalaryMax);
      const currency = str(r.salaryCurrency, 8) || "USD";
      return listing({
        source: "jobicy",
        sourceId: str(r.id, 200),
        title: str(r.jobTitle),
        company: str(r.companyName),
        url: str(r.url),
        location: str(r.jobGeo) || "Remote",
        pay: formatPay(min, max, currency),
        summary: str(r.jobExcerpt),
        tags: asList(r.jobIndustry).map((t) => str(t, 40)),
        postedAt: iso(r.pubDate),
        currency,
        minBudget: min,
        maxBudget: max,
      });
    })
    .filter(matches(query))
    .slice(0, PER_SOURCE);
}

async function himalayas(query: string): Promise<JobListing[]> {
  const url = query
    ? `https://himalayas.app/jobs/api/search?${new URLSearchParams({ q: query.slice(0, 80), sort: "recent" })}`
    : "https://himalayas.app/jobs/api?limit=20";
  const data = asRecord(await readJson(url));
  return asList(data?.jobs ?? data?.data)
    .map((row) => {
      const r = asRecord(row);
      if (!r) return null;
      const min = num(r.minSalary ?? r.salaryMin);
      const max = num(r.maxSalary ?? r.salaryMax);
      return listing({
        source: "himalayas",
        sourceId: str(r.guid || r.slug || r.id, 200),
        title: str(r.title),
        company: str(asRecord(r.company)?.name ?? r.companyName),
        url: str(r.applicationLink || r.url),
        location:
          asList(r.locationRestrictions).map((t) => str(t, 40)).filter(Boolean).join(", ") ||
          str(r.location) ||
          "Remote",
        pay: formatPay(min, max, str(r.currency, 8) || "USD"),
        summary: str(r.description || r.excerpt),
        tags: asList(r.skills ?? r.categories).map((t) => str(asRecord(t)?.name ?? t, 40)),
        postedAt: iso(r.pubDate || r.createdAt),
        currency: str(r.currency, 8) || "USD",
        minBudget: min,
        maxBudget: max,
      });
    })
    .filter(matches(query))
    .slice(0, PER_SOURCE);
}

async function adzuna(query: string): Promise<JobListing[] | "off"> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return "off";
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: (query || "developer").slice(0, 80),
    content_type: "application/json",
  });
  const data = asRecord(
    await readJson(`https://api.adzuna.com/v1/api/jobs/in/search/1?${params}`),
  );
  return asList(data?.results)
    .map((row) => {
      const r = asRecord(row);
      if (!r) return null;
      const company = asRecord(r.company);
      const loc = asRecord(r.location);
      const min = num(r.salary_min);
      const max = num(r.salary_max);
      return listing({
        source: "adzuna",
        sourceId: str(r.id, 200),
        title: str(r.title),
        company: str(company?.display_name),
        url: str(r.redirect_url || r.adref),
        location: str(loc?.display_name) || "India",
        pay: formatPay(min, max, "INR"),
        summary: str(r.description),
        postedAt: iso(r.created),
        currency: "INR",
        minBudget: min,
        maxBudget: max,
      });
    })
    .filter(matches(query))
    .slice(0, PER_SOURCE);
}

function matches(query: string) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1);
  return (item: JobListing | null): item is JobListing => {
    if (!item) return false;
    if (!words.length) return true;
    const hay =
      `${item.title} ${item.company} ${item.location} ${item.tags.join(" ")} ${item.summary}`.toLowerCase();
    return words.some((w) => hay.includes(w));
  };
}

function score(item: JobListing, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return Date.parse(item.postedAt ?? "") || 0;
  const title = item.title.toLowerCase();
  let n = 0;
  for (const w of words) {
    if (title.includes(w)) n += 5;
    else if (`${item.company} ${item.tags.join(" ")}`.toLowerCase().includes(w)) n += 2;
    else if (item.summary.toLowerCase().includes(w)) n += 1;
  }
  return n * 1e12 + (Date.parse(item.postedAt ?? "") || 0);
}

async function settle(
  source: JobSource,
  work: () => Promise<JobListing[] | "off">,
): Promise<{ source: JobSource; listings: JobListing[]; state: SourceState }> {
  try {
    const listings = await work();
    if (listings === "off") return { source, listings: [], state: "off" };
    return { source, listings, state: "ok" };
  } catch {
    return { source, listings: [], state: "fail" };
  }
}

export function adzunaConfigured() {
  return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

export async function searchJobs(
  query: string,
  keys: { freelancer?: string | null; upwork?: string | null } = {},
): Promise<JobSearch> {
  const q = query.trim().slice(0, 120);
  const tasks = [
    settle("remoteok", () => remoteok(q)),
    settle("remotive", () => remotive(q)),
    settle("arbeitnow", () => arbeitnow(q)),
    settle("jobicy", () => jobicy(q)),
    settle("himalayas", () => himalayas(q)),
    settle("adzuna", () => adzuna(q)),
    settle("freelancer", async () => {
      if (!keys.freelancer) return "off";
      const result = await searchFreelancerProjects(keys.freelancer, q);
      if (!result.ok) throw new Error(result.error);
      return result.data
        .map((p) =>
          listing({
            source: "freelancer",
            sourceId: String(p.id),
            title: p.title,
            company: "Client on Freelancer",
            url: p.url,
            location: p.location,
            pay: formatPay(p.minBudget, p.maxBudget, p.currency),
            summary: p.preview,
            tags: p.tags,
            postedAt: p.postedAt,
            kind: "gig",
            currency: p.currency,
            minBudget: p.minBudget,
            maxBudget: p.maxBudget,
          }),
        )
        .filter((item): item is JobListing => Boolean(item));
    }),
    settle("upwork", async () => {
      if (!keys.upwork) return "off";
      const result = await searchUpworkJobs(keys.upwork, q);
      if (!result.ok) throw new Error(result.error);
      return result.data
        .map((j) =>
          listing({
            source: "upwork",
            sourceId: j.id.slice(0, 200),
            title: j.title,
            company: "Client on Upwork",
            url: j.url,
            location: j.location,
            pay: j.pay,
            summary: j.preview,
            postedAt: j.postedAt,
            kind: "gig",
          }),
        )
        .filter((item): item is JobListing => Boolean(item));
    }),
  ];

  const results = await Promise.all(tasks);
  const sources: JobSearch["sources"] = {};
  const listings: JobListing[] = [];
  for (const row of results) {
    sources[row.source] = row.state;
    listings.push(...row.listings);
  }
  listings.sort((a, b) => score(b, q) - score(a, q));
  return { query: q, listings: listings.slice(0, MAX_LISTINGS), sources };
}
