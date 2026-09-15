import type { Evidence } from "./types";

const MAX_STRING = 200;
const MAX_TOOL_BYTES = 6000;

function trimStrings(value: unknown): unknown {
  if (typeof value === "string")
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (Array.isArray(value)) return value.map(trimStrings);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, trimStrings(v)]),
    );
  return value;
}

export function compact(
  tool: string,
  input: unknown,
  output: unknown,
): Evidence {
  let trimmed = trimStrings(output);
  let json = JSON.stringify(trimmed);
  if (json && json.length > MAX_TOOL_BYTES) {
    trimmed = {
      truncated: true,
      note: "Result was too large; only the beginning is shown. Prefer aggregating.",
      preview: json.slice(0, MAX_TOOL_BYTES),
    };
    json = JSON.stringify(trimmed);
  }
  return { tool, input, output: trimmed };
}

export const STATUS_LABELS: Record<string, string> = {
  get_finance_overview: "Adding up your money…",
  list_transactions: "Checking your transactions…",
  list_categories: "Looking at your categories…",
  get_profile: "Checking your profile…",
  list_users: "Looking up users…",
  run_sql: "Digging through your data…",
};
