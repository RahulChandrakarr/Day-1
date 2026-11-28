import "server-only";
import { Client } from "pg";

// Keys people paste to link their own accounts on outside services. They sit
// in private.integration_keys, which the browser's data API can't reach, so
// they're read and written here over the direct database connection. Callers
// pass the user id from the verified session (requireProfile), never from the
// browser, and nothing returned to the browser may include the secret.

export type Provider = "splitwise" | "freelancer" | "upwork" | "youtube" | "instagram";

export type IntegrationKey = {
  secret: string;
  accountName: string | null;
  connectedAt: string;
};

function isLoopback(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /@localhost\b|@127\.0\.0\.1\b/.test(url);
  }
}

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (url && !isLoopback(url)) return url;
  const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, "").split(".")[0];
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (ref && password) {
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
  }
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

async function withDatabase<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export async function getIntegrationKey(
  userId: string,
  provider: Provider,
): Promise<IntegrationKey | null> {
  return withDatabase(async (client) => {
    const { rows } = await client.query<{
      secret: string;
      account_name: string | null;
      connected_at: Date;
    }>(
      `select secret, account_name, connected_at
       from private.integration_keys where user_id = $1 and provider = $2`,
      [userId, provider],
    );
    const row = rows[0];
    return row
      ? {
          secret: row.secret,
          accountName: row.account_name,
          connectedAt: row.connected_at.toISOString(),
        }
      : null;
  });
}

export async function saveIntegrationKey(
  userId: string,
  provider: Provider,
  secret: string,
  account: { name: string | null; id: string | null },
) {
  await withDatabase((client) =>
    client.query(
      `insert into private.integration_keys
         (user_id, provider, secret, account_name, account_id, connected_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (user_id, provider) do update
         set secret = excluded.secret,
             account_name = excluded.account_name,
             account_id = excluded.account_id,
             connected_at = now()`,
      [userId, provider, secret, account.name?.slice(0, 120) ?? null, account.id],
    ),
  );
}

export async function deleteIntegrationKey(userId: string, provider: Provider) {
  await withDatabase((client) =>
    client.query(
      "delete from private.integration_keys where user_id = $1 and provider = $2",
      [userId, provider],
    ),
  );
}
