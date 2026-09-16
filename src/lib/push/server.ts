import "server-only";
import webpush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  sticky?: boolean; // stays in the shade until swiped away
  silent?: boolean; // no sound or vibration
  actions?: { action: string; title: string; url: string }[];
};

export type Subscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

let configured = false;

function configure() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:notifications@example.com",
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

// Sends one notification. Returns "gone" when the phone unsubscribed,
// so the caller can drop the row.
export async function sendPush(
  subscription: Subscription,
  payload: PushPayload,
): Promise<"sent" | "gone" | "failed"> {
  if (!configure()) return "failed";
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 6 * 60 * 60 },
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}
