import { getApiSession, jsonError } from "@/lib/ai/session";

export async function GET() {
  const session = await getApiSession();
  if (!session) return jsonError("Not signed in", 401);

  const { data, error } = await session.supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) return jsonError(error.message, 500);

  return Response.json(data);
}
