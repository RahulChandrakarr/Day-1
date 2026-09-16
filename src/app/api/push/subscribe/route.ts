import { createClient } from "@/lib/supabase/server";

type Body = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

async function user() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return id ? { supabase, id } : null;
}

// Save this phone or browser so reminders can reach it
export async function POST(request: Request) {
  const session = await user();
  if (!session)
    return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth)
    return Response.json({ error: "Invalid subscription" }, { status: 400 });

  const { error } = await session.supabase.from("push_subscriptions").upsert(
    {
      endpoint: body.endpoint,
      user_id: session.id,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// Turning notifications off on this device
export async function DELETE(request: Request) {
  const session = await user();
  if (!session)
    return Response.json({ error: "Not signed in" }, { status: 401 });
  const { endpoint } = (await request.json().catch(() => ({}))) as Body;
  if (!endpoint)
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  await session.supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  return Response.json({ ok: true });
}
