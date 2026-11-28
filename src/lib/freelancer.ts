import "server-only";

// Freelancer.com REST API. Search and bids need the personal OAuth token the
// person pastes in Settings → Integrations. Docs: https://developers.freelancer.com
// Header is freelancer-oauth-v1, not Bearer.

const API = "https://www.freelancer.com/api";

export type FreelancerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; keyRejected?: boolean };

export type FreelancerSelf = { id: number; name: string };

export type FreelancerProject = {
  id: number;
  title: string;
  preview: string;
  url: string;
  location: string;
  currency: string | null;
  minBudget: number | null;
  maxBudget: number | null;
  postedAt: string | null;
  tags: string[];
};

type Envelope<T> = {
  status?: string;
  message?: string;
  result?: T;
};

async function call<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<FreelancerResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "freelancer-oauth-v1": token,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return { ok: false, error: "Couldn't reach Freelancer. Try again in a moment." };
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    body = null;
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      keyRejected: true,
      error: "Freelancer didn't accept that token. Create a new one on their developer portal.",
    };
  }
  if (!response.ok || body?.status === "error") {
    return {
      ok: false,
      error: body?.message?.slice(0, 200) || `Freelancer returned ${response.status}.`,
    };
  }
  if (body?.result == null) {
    return { ok: false, error: "Freelancer sent an empty reply." };
  }
  return { ok: true, data: body.result };
}

export async function getFreelancerSelf(token: string): Promise<FreelancerResult<FreelancerSelf>> {
  const result = await call<{
    id?: number;
    username?: string | null;
    display_name?: string | null;
    public_name?: string | null;
  }>(token, "/users/0.1/self/");
  if (!result.ok) return result;
  const id = result.data.id;
  if (!id) return { ok: false, error: "Freelancer didn't return a user id." };
  const name =
    result.data.display_name?.trim() ||
    result.data.public_name?.trim() ||
    result.data.username?.trim() ||
    `Freelancer #${id}`;
  return { ok: true, data: { id, name } };
}

export async function searchFreelancerProjects(
  token: string,
  query: string,
): Promise<FreelancerResult<FreelancerProject[]>> {
  const params = new URLSearchParams({
    limit: "20",
    compact: "true",
    full_description: "true",
    job_details: "true",
  });
  const q = query.trim();
  if (q) params.set("query", q.slice(0, 120));
  const result = await call<{
    projects?: {
      id: number;
      title?: string | null;
      seo_url?: string | null;
      preview_description?: string | null;
      description?: string | null;
      type?: string | null;
      budget?: { minimum?: number | null; maximum?: number | null } | null;
      currency?: { code?: string | null } | null;
      time_submitted?: number | null;
      jobs?: { name?: string | null }[] | null;
    }[];
  }>(token, `/projects/0.1/projects/active/?${params}`);
  if (!result.ok) return result;

  const projects = (result.data.projects ?? [])
    .filter((p) => p.id && p.title)
    .map((p): FreelancerProject => {
      const slug = p.seo_url?.replace(/^\//, "") || String(p.id);
      return {
        id: p.id,
        title: p.title!.trim(),
        preview: (p.preview_description || p.description || "").replace(/<[^>]+>/g, " ").trim(),
        url: `https://www.freelancer.com/projects/${slug}`,
        location: p.type === "local" ? "On site" : "Remote",
        currency: p.currency?.code ?? null,
        minBudget: p.budget?.minimum ?? null,
        maxBudget: p.budget?.maximum ?? null,
        postedAt: p.time_submitted ? new Date(p.time_submitted * 1000).toISOString() : null,
        tags: (p.jobs ?? []).map((j) => j.name?.trim()).filter((n): n is string => Boolean(n)),
      };
    });
  return { ok: true, data: projects };
}

export async function placeFreelancerBid(
  token: string,
  input: {
    projectId: number;
    amount: number;
    days: number;
    description: string;
  },
): Promise<FreelancerResult<{ bidId: number }>> {
  const self = await getFreelancerSelf(token);
  if (!self.ok) return self;

  const result = await call<{ id?: number }>(token, "/projects/0.1/bids/", {
    method: "POST",
    body: JSON.stringify({
      project_id: input.projectId,
      bidder_id: self.data.id,
      amount: input.amount,
      period: input.days,
      milestone_percentage: 100,
      description: input.description,
    }),
  });
  if (!result.ok) return result;
  const bidId = result.data.id;
  if (!bidId) return { ok: false, error: "Freelancer accepted the bid but didn't return an id." };
  return { ok: true, data: { bidId } };
}
