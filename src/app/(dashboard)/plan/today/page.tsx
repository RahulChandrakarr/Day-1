import { redirect } from "next/navigation";

// Today is the Plan section's main page now; keep old links working.
export default async function PlanTodayRedirect({
  searchParams,
}: PageProps<"/plan/today">) {
  const { date } = await searchParams;
  redirect(typeof date === "string" ? `/plan?date=${date}` : "/plan");
}
