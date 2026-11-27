import { createClient } from "@/lib/supabase/server";

// The person's own photos (profile picture, background), served at an address
// that stays the same for as long as the photo does. A signed Storage link is
// different every time it is made, so the browser could never keep the photo
// and fetched it again on every visit. A new upload gets a new file name, and
// so a new address: the copy kept on the device never goes out of date.
const BUCKETS = new Set(["avatars", "backgrounds"]);
const IMAGE = /^image\/(jpeg|png|webp)$/;

// GET /api/media/avatars?p=<user id>/avatar-123.jpg
export async function GET(request: Request, { params }: RouteContext<"/api/media/[bucket]">) {
  const { bucket } = await params;
  const path = new URL(request.url).searchParams.get("p") ?? "";
  if (!BUCKETS.has(bucket) || !path) return new Response(null, { status: 404 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  // Storage only hands over a person's own folder; this says no before asking it
  if (!path.startsWith(`${userId}/`)) return new Response(null, { status: 404 });

  const { data: file, error } = await supabase.storage.from(bucket).download(path);
  if (error || !file) return new Response(null, { status: 404 });

  return new Response(file.stream(), {
    headers: {
      "Content-Type": IMAGE.test(file.type) ? file.type : "application/octet-stream",
      "Content-Length": String(file.size),
      // Kept on this device only, never by a shared cache in between
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
