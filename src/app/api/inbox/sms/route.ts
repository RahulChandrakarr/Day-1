import { Client } from "pg";
import { looksLikeJunk, parseBankSms, smsFingerprint } from "@/lib/sms-parse";
import { todayISO } from "@/lib/finance";

// Where bank messages forwarded from the phone arrive.
//
// There is no login here: an automation app on the phone can't hold a session,
// so the URL carries a token that identifies whose inbox this is. The token
// does one thing — add a message waiting to be confirmed — and can be rotated
// from Settings. Nothing here writes money.

export const maxDuration = 30;

const MAX_BODY = 1000;

function readToken(request: Request, payload: Record<string, unknown>) {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  const url = new URL(request.url);
  return (url.searchParams.get("token") ?? String(payload.token ?? "")).trim();
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return Response.json({ error: "DATABASE_URL is not set" }, { status: 500 });

  // Automation apps send JSON or a plain form; accept both
  let payload: Record<string, unknown> = {};
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      payload = (await request.json()) as Record<string, unknown>;
    } else {
      const form = await request.formData();
      payload = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    }
  } catch {
    return Response.json({ error: "Send JSON or form fields" }, { status: 400 });
  }

  const token = readToken(request, payload);
  if (!/^[0-9a-f-]{36}$/i.test(token))
    return Response.json({ error: "Not allowed" }, { status: 401 });

  const body = String(payload.body ?? payload.message ?? payload.text ?? "")
    .slice(0, MAX_BODY)
    .trim();
  if (!body) return Response.json({ error: "No message" }, { status: 400 });
  const sender = String(payload.sender ?? payload.from ?? "").slice(0, 60) || null;

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      "select id from public.profiles where inbox_token = $1",
      [token],
    );
    const userId = rows[0]?.id;
    if (!userId) return Response.json({ error: "Not allowed" }, { status: 401 });

    // An OTP or an advert never gets stored
    if (looksLikeJunk(body)) return Response.json({ ok: true, status: "ignored" });

    const parsed = parseBankSms(body, todayISO());
    if (!parsed) {
      // Kept so it can be entered by hand and the parser taught about it
      await client.query(
        `insert into public.finance_inbox (user_id, sender, body, fingerprint)
         values ($1, $2, $3, $4) on conflict (user_id, fingerprint) do nothing`,
        [userId, sender, body, `raw|${body.slice(0, 120).toLowerCase()}`],
      );
      return Response.json({ ok: true, status: "unreadable" });
    }

    // Match the account by its last digits, when they're recorded
    const { rows: accounts } = await client.query<{ id: string }>(
      `select id from public.bank_accounts
       where user_id = $1 and account_tail is not null and $2 like '%' || account_tail`,
      [userId, parsed.accountTail ?? ""],
    );

    const inserted = await client.query(
      `insert into public.finance_inbox
         (user_id, sender, body, direction, amount, account_tail, merchant, reference,
          occurred_on, bank_account_id, fingerprint)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (user_id, fingerprint) do nothing
       returning id`,
      [
        userId,
        sender,
        body,
        parsed.direction,
        parsed.amount,
        parsed.accountTail,
        parsed.merchant,
        parsed.reference,
        parsed.occurredOn,
        accounts[0]?.id ?? null,
        smsFingerprint(parsed, body),
      ],
    );

    return Response.json({
      ok: true,
      status: inserted.rowCount ? "saved" : "duplicate",
      amount: parsed.amount,
      direction: parsed.direction,
    });
  } finally {
    await client.end();
  }
}
