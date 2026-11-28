import { generateText } from "ai";
import { Client, type QueryResultRow } from "pg";
import { answerModel, answerProviderOptions } from "@/lib/ai/models";
import { briefingInstructions } from "@/lib/ai/prompts";
import { sendPush, type PushPayload } from "@/lib/push/server";
import { APP_TIMEZONE } from "@/lib/finance";

export const maxDuration = 60;

type Kind = "briefing" | "journal" | "habits" | "gym" | "money" | "plan";

type Due = {
  user_id: string;
  kind: Kind;
  name: string | null;
};

// Now, in the app's timezone
function localNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: new Date(
      `${get("year")}-${get("month")}-${get("day")}T00:00:00Z`,
    ).getUTCDay(),
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  // Vercel sends the secret as a bearer token
  if (secret && auth !== `Bearer ${secret}`)
    return Response.json({ error: "Not allowed" }, { status: 401 });
  if (!process.env.DATABASE_URL)
    return Response.json({ error: "DATABASE_URL is not set" }, { status: 500 });

  const now = localNow();
  const isoWeekday = ((now.weekday + 6) % 7) + 1;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // A write every time this daily job runs, so a quiet week still
    // counts as database activity. Missing on older databases is fine.
    try {
      await client.query("select public.record_heartbeat()");
    } catch {
      // Heartbeat is optional; reminders still go out.
    }

    // Raw chat lines older than 30 days go away; lasting summaries stay.
    try {
      await client.query(
        "delete from public.ai_messages where created_at < now() - interval '30 days'",
      );
    } catch {
      // Older databases without this table still send reminders.
    }

    // Due within the last 3 hours and not sent yet today. The window lets a
    // late or infrequent run (Vercel Hobby runs this once a day, at 06:30-07:30
    // India time) still deliver, while an every-15-minutes scheduler is punctual.
    const { rows: due } = await client.query<Due>(
      `select s.user_id, s.kind, p.full_name as name
         from reminder_settings s
         join profiles p on p.id = s.user_id
        where s.enabled
          and s.kind <> 'spend_pin'
          and (s.hour * 60 + s.minute) between $1 - 180 and $1
          and not exists (
            select 1 from reminder_sends r
             where r.user_id = s.user_id and r.kind = s.kind and r.sent_on = $2
          )`,
      [now.minutes, now.date],
    );

    const results: Record<string, string> = {};
    for (const item of due) {
      const payload = await buildPayload(client, item, now.date, isoWeekday);
      if (!payload) {
        results[`${item.user_id}:${item.kind}`] = "nothing to say";
        continue;
      }

      const { rows: subs } = await client.query<{
        endpoint: string;
        p256dh: string;
        auth: string;
      }>("select endpoint, p256dh, auth from push_subscriptions where user_id = $1",
        [item.user_id]);
      if (subs.length === 0) {
        results[`${item.user_id}:${item.kind}`] = "no devices";
        continue;
      }

      let sent = 0;
      for (const sub of subs) {
        const status = await sendPush(sub, payload);
        if (status === "sent") sent++;
        if (status === "gone")
          await client.query("delete from push_subscriptions where endpoint = $1", [
            sub.endpoint,
          ]);
      }
      if (sent > 0)
        await client.query(
          `insert into reminder_sends (user_id, kind, sent_on) values ($1, $2, $3)
           on conflict do nothing`,
          [item.user_id, item.kind, now.date],
        );
      results[`${item.user_id}:${item.kind}`] = `sent to ${sent}`;
    }

    return Response.json({ checked: due.length, results });
  } finally {
    await client.end();
  }
}

// What to say, or null when the thing is already done
async function buildPayload(
  client: Client,
  item: Due,
  date: string,
  isoWeekday: number,
): Promise<PushPayload | null> {
  const one = async <T extends QueryResultRow>(sql: string, params: unknown[]) =>
    (await client.query<T>(sql, params)).rows[0];

  if (item.kind === "journal") {
    const row = await one<{ count: string }>(
      "select count(*) from journal_entries where user_id = $1 and entry_date = $2",
      [item.user_id, date],
    );
    if (Number(row.count) > 0) return null;
    return {
      title: "Today's journal is empty",
      body: "Two minutes: mood, what happened, what's next.",
      url: "/daily",
      tag: "journal",
    };
  }

  if (item.kind === "habits") {
    const row = await one<{ total: string; done: string }>(
      `select (select count(*) from journal_habits where user_id = $1) as total,
              (select count(*) from habit_checkins
                where user_id = $1 and check_date = $2) as done`,
      [item.user_id, date],
    );
    const pending = Number(row.total) - Number(row.done);
    if (Number(row.total) === 0 || pending <= 0) return null;
    return {
      title: `${pending} habit${pending === 1 ? "" : "s"} to check in`,
      body: "Mark what you managed today.",
      url: "/health/habits",
      tag: "habits",
    };
  }

  if (item.kind === "gym") {
    const row = await one<{ title: string; planned: string; done: string }>(
      `with active as (
         select id from gym_blocks
          where user_id = $1 and start_date <= $2
            and start_date + (weeks * 7 - 1) >= $2
          order by start_date desc limit 1
       ),
       day as (
         select d.id, d.title, d.rest
           from gym_plan_days d
          where d.user_id = $1 and d.weekday = $3
            and d.block_id is not distinct from (select id from active)
          limit 1
       )
       select coalesce((select title from day), '') as title,
              (select count(*) from gym_plan_exercises e
                where e.day_id = (select id from day)
                  and not coalesce((select rest from day), false)) as planned,
              (select count(*) from gym_checkins c
                join gym_plan_exercises e on e.id = c.exercise_id
               where c.user_id = $1 and c.check_date = $2
                 and e.day_id = (select id from day)) as done`,
      [item.user_id, date, isoWeekday],
    );
    const planned = Number(row?.planned ?? 0);
    if (planned === 0 || Number(row?.done ?? 0) > 0) return null;
    return {
      title: row.title ? `${row.title} today` : "Workout today",
      body: `${planned} exercises waiting. Tick them off as you go.`,
      url: "/health/gym",
      tag: "gym",
    };
  }

  if (item.kind === "plan") {
    const { rows } = await client.query<{ title: string; emoji: string }>(
      `select i.title, g.emoji
         from plan_items i
         join plan_goals g on g.id = i.goal_id
        where i.user_id = $1 and i.level = 'day' and i.period = $2 and not i.done
        order by i.position
        limit 5`,
      [item.user_id, date],
    );
    if (rows.length === 0) return null;
    return {
      title: `${rows.length} plan task${rows.length === 1 ? "" : "s"} today`,
      body: rows.map((r) => `${r.emoji} ${r.title}`).join(" · ").slice(0, 180),
      url: "/plan",
      tag: "plan",
    };
  }

  if (item.kind === "money") {
    const row = await one<{ count: string }>(
      "select count(*) from finance_transactions where user_id = $1 and occurred_on = $2",
      [item.user_id, date],
    );
    if (Number(row.count) > 0) return null;
    return {
      title: "Nothing logged today",
      body: "Add what you spent or earned before you forget.",
      url: "/financial/daily",
      tag: "money",
    };
  }

  // Morning briefing, written by the assistant
  const text = await writeBriefing(client, item, date);
  if (!text) return null;
  return {
    title: "Good morning ☀️",
    body: text.replace(/[*_#`]/g, "").split("\n")[0].slice(0, 180),
    url: "/assistant",
    tag: "briefing",
  };
}

// Builds the morning briefing from the database and stores it where the
// Assistant tab reads it.
async function writeBriefing(client: Client, item: Due, date: string) {
  const existing = await client.query<{ content: string }>(
    "select content from ai_briefings where user_id = $1 and for_date = $2",
    [item.user_id, date],
  );
  if (existing.rows[0]?.content) return existing.rows[0].content;
  if (!process.env.OPENROUTER_API_KEY) return null;

  const month = date.slice(0, 7);
  const { rows } = await client.query(
    `select
       (select json_build_object(
          'spent', coalesce(sum(amount) filter (where type = 'expense'), 0),
          'earned', coalesce(sum(amount) filter (where type = 'income'), 0))
          from finance_transactions
         where user_id = $1 and to_char(occurred_on, 'YYYY-MM') = $3) as month_money,
       (select json_agg(json_build_object('category', c.name, 'amount', t.total))
          from (select category_id, sum(amount) total from finance_transactions
                 where user_id = $1 and type = 'expense'
                   and to_char(occurred_on, 'YYYY-MM') = $3
                 group by category_id order by 2 desc limit 3) t
          left join finance_categories c on c.id = t.category_id) as top_spend,
       (select json_build_object('title', d.title, 'rest', d.rest,
                 'exercises', (select count(*) from gym_plan_exercises e where e.day_id = d.id))
          from gym_plan_days d
         where d.user_id = $1
           and d.weekday = ((extract(isodow from $2::date))::int)
         order by d.block_id nulls last limit 1) as today_workout,
       (select json_agg(json_build_object('habit', h.name, 'kind', h.kind,
                 'done_last_7', (select count(*) from habit_checkins c
                    where c.habit_id = h.id and c.done
                      and c.check_date > $2::date - 7)))
          from journal_habits h where h.user_id = $1) as habits,
       (select json_build_object('weight', weight_kg, 'on', logged_on)
          from body_logs where user_id = $1
         order by logged_on desc limit 1) as latest_weight,
       (select json_build_object('mood', mood, 'notes', left(notes, 400))
          from journal_entries where user_id = $1 and entry_date = $2::date - 1) as yesterday,
       (select json_agg(json_build_object('label', m.label, 'value', m.value))
          from (select label, value from assistant_memories
                 where user_id = $1 order by updated_at desc limit 20) m) as known,
       (select json_agg(json_build_object('title', s.title, 'summary', left(s.summary, 400)))
          from (select title, summary from ai_chat_summaries
                 where user_id = $1 order by updated_at desc limit 6) s) as recent_chats`
    [item.user_id, date, month],
  );

  const context = { date, ...rows[0] };
  const result = await generateText({
    model: answerModel,
    instructions: briefingInstructions(item.name?.split(" ")[0] ?? "there"),
    prompt: `<data>${JSON.stringify(context)}</data>\n\nWrite today's check-in message.`,
    temperature: 0.8,
    maxOutputTokens: 700,
    providerOptions: answerProviderOptions,
  });
  const content = result.text.trim();
  if (!content) return null;

  await client.query(
    `insert into ai_briefings (user_id, for_date, content, refresh_count, updated_at)
     values ($1, $2, $3, 0, now())
     on conflict (user_id, for_date) do update set content = excluded.content,
       updated_at = now()`,
    [item.user_id, date, content.slice(0, 20000)],
  );
  return content;
}
