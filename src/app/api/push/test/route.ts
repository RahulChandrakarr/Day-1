import { sendPush } from "@/lib/push/server";
import { createClient } from "@/lib/supabase/server";

// "Send a test" button in settings
export async function POST() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub)
    return Response.json({ error: "Not signed in" }, { status: 401 });

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (!subs?.length)
    return Response.json(
      { error: "No device is set up for notifications yet." },
      { status: 400 },
    );

  let sent = 0;
  for (const sub of subs) {
    const result = await sendPush(sub, {
      title: "Day One",
      body: "Notifications are working 🎉",
      url: "/",
      tag: "test",
    });
    if (result === "sent") sent++;
    if (result === "gone")
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", sub.endpoint);
  }

  return sent
    ? Response.json({ ok: true, sent })
    : Response.json({ error: "Couldn't reach this device." }, { status: 500 });
}
