import "server-only";
import type { Supabase } from "./types";

type TableInfo = {
  table: string;
  comment: string | null;
  columns: { name: string; type: string; comment: string | null }[];
};

const TTL_MS = 10 * 60 * 1000;
let cache: { text: string; at: number } | null = null;

// Compact, model-friendly description of the readable tables.
export async function getSchemaText(supabase: Supabase) {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.text;

  const { data, error } = await supabase.rpc("ai_schema", {}, { get: true });
  if (error || !Array.isArray(data)) return cache?.text ?? "";

  const text = (data as TableInfo[])
    .map((t) => {
      const cols = t.columns
        .filter((c) => c.name !== "user_id")
        .map(
          (c) => `${c.name} ${c.type}${c.comment ? ` /* ${c.comment} */` : ""}`,
        )
        .join(", ");
      return `- ${t.table}(${cols})${t.comment ? ` -- ${t.comment}` : ""}`;
    })
    .join("\n");

  cache = { text, at: Date.now() };
  return text;
}
