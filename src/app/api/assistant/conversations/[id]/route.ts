import { getApiSession, jsonError } from "@/lib/ai/session";
import type { AssistantUIMessage } from "@/lib/ai/types";

const uuid = /^[0-9a-f-]{36}$/i;

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/assistant/conversations/[id]">,
) {
  const { id } = await ctx.params;
  if (!uuid.test(id)) return jsonError("Not found", 404);
  const session = await getApiSession();
  if (!session) return jsonError("Not signed in", 401);

  const { data, error } = await session.supabase
    .from("ai_messages")
    .select("id, role, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return jsonError(error.message, 500);

  const messages: AssistantUIMessage[] = data.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text", text: m.content }],
  }));
  return Response.json(messages);
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/assistant/conversations/[id]">,
) {
  const { id } = await ctx.params;
  if (!uuid.test(id)) return jsonError("Not found", 404);
  const session = await getApiSession();
  if (!session) return jsonError("Not signed in", 401);

  const { error } = await session.supabase
    .from("ai_conversations")
    .delete()
    .eq("id", id);
  if (error) return jsonError(error.message, 500);

  return new Response(null, { status: 204 });
}
