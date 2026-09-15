import type { Metadata } from "next";
import PageShell from "@/components/dashboard/page-shell";
import PlanSummary from "@/components/finance/budget/plan-summary";
import {
  budgetReport,
  formatMonth,
  monthRange,
  todayISO,
} from "@/lib/finance";
import { getBudget, getTransactions } from "@/lib/finance-queries";

export const metadata: Metadata = {
  title: "Overview · Day One",
};

export default async function OverviewPage() {
  const today = todayISO();
  const month = today.slice(0, 7);
  const [budget, transactions] = await Promise.all([
    getBudget("month", month),
    getTransactions(monthRange(month)),
  ]);

  return (
    <PageShell title="Overview" description="Your life at a glance.">
      <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
        <PlanSummary
          monthLabel={formatMonth(month)}
          report={
            budget
              ? budgetReport(budget, "month", month, transactions, today)
              : null
          }
        />
      </div>
    </PageShell>
  );
}
