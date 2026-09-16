import { financeReport } from "@/lib/pdf/finance";
import { healthReport } from "@/lib/pdf/health";
import { journalReport } from "@/lib/pdf/journal";
import { planReport } from "@/lib/pdf/plan";
import { todayISO } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET /api/reports/finance?month=2026-09 (or ?year=2026) → PDF download
export async function GET(request: Request, { params }: RouteContext<"/api/reports/[kind]">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return new Response("Sign in first.", { status: 401 });

  const { kind } = await params;
  const search = new URL(request.url).searchParams;
  const monthParam = search.get("month");
  const yearParam = Number(search.get("year"));
  const byYear = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2200;
  const month = monthParam && MONTH.test(monthParam) ? monthParam : todayISO().slice(0, 7);
  const period = byYear && (kind === "finance" || kind === "plan") ? { year: yearParam } : { month };
  const label = "year" in period ? String(period.year) : period.month;

  let bytes: Uint8Array;
  try {
    switch (kind) {
      case "finance":
        bytes = await financeReport(period);
        break;
      case "plan":
        bytes = await planReport(period);
        break;
      case "health":
        bytes = await healthReport(month);
        break;
      case "journal":
        bytes = await journalReport(month);
        break;
      default:
        return new Response("Unknown report.", { status: 404 });
    }
  } catch (error) {
    console.error("report failed", kind, error);
    return new Response("Couldn't build the report. Try again.", { status: 500 });
  }

  const filename = `day-one-${kind}-${"year" in period || kind === "finance" || kind === "plan" ? label : month}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${search.get("view") ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
