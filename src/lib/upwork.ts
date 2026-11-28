import "server-only";

// Upwork GraphQL, search only. There is no public mutation to send a proposal.
// Needs a personal GraphQL access token from an approved Upwork API app.

const API = "https://api.upwork.com/graphql";

export type UpworkResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; keyRejected?: boolean };

export type UpworkSelf = { name: string };

export type UpworkJob = {
  id: string;
  title: string;
  preview: string;
  url: string;
  location: string;
  pay: string | null;
  postedAt: string | null;
};

type Gql = {
  data?: Record<string, unknown>;
  errors?: { message?: string }[];
};

async function graphql(token: string, query: string, variables: Record<string, unknown> = {}) {
  let response: Response;
  try {
    response = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return { ok: false as const, error: "Couldn't reach Upwork. Try again in a moment." };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false as const,
      keyRejected: true,
      error: "Upwork didn't accept that token. Check the GraphQL token on your Upwork API app.",
    };
  }

  let body: Gql | null = null;
  try {
    body = (await response.json()) as Gql;
  } catch {
    body = null;
  }
  if (!response.ok) {
    return { ok: false as const, error: `Upwork returned ${response.status}.` };
  }
  const message = body?.errors?.[0]?.message;
  if (message) {
    const rejected = /unauthor|auth|token|forbidden/i.test(message);
    return { ok: false as const, error: message.slice(0, 200), keyRejected: rejected };
  }
  return { ok: true as const, data: body?.data ?? {} };
}

export async function getUpworkSelf(token: string): Promise<UpworkResult<UpworkSelf>> {
  const result = await graphql(token, `{ user { id name } }`);
  if (!result.ok) return result;
  const user = result.data.user as { name?: string } | undefined;
  return { ok: true, data: { name: user?.name?.trim() || "Upwork account" } };
}

export async function searchUpworkJobs(
  token: string,
  query: string,
): Promise<UpworkResult<UpworkJob[]>> {
  const q = query.trim().slice(0, 120) || "developer";
  const result = await graphql(
    token,
    `query Search($q: String) {
      marketplaceJobPostings(
        searchType: USER_JOBS_SEARCH
        marketPlaceJobFilter: { searchExpression_eq: $q }
      ) {
        edges {
          node {
            id
            title
            description
            ciphertext
            createdDateTime
            amount { displayValue currency }
          }
        }
      }
    }`,
    { q },
  );
  if (!result.ok) return result;

  const listing = result.data.marketplaceJobPostings as
    | {
        edges?: {
          node?: {
            id?: string;
            title?: string;
            description?: string;
            ciphertext?: string;
            createdDateTime?: string;
            amount?: { displayValue?: string; currency?: string } | null;
          };
        }[];
      }
    | undefined;

  const jobs = (listing?.edges ?? [])
    .map((e) => e.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n?.id && n.title))
    .map((n): UpworkJob => {
      const cipher = n.ciphertext?.replace(/^~/, "") ?? n.id!;
      return {
        id: n.id!,
        title: n.title!.trim(),
        preview: (n.description ?? "").replace(/<[^>]+>/g, " ").trim(),
        url: `https://www.upwork.com/jobs/~${cipher}`,
        location: "Remote",
        pay: n.amount?.displayValue ?? n.amount?.currency ?? null,
        postedAt: n.createdDateTime ?? null,
      };
    });
  return { ok: true, data: jobs };
}
