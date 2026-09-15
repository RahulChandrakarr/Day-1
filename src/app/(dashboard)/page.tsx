import type { Metadata } from "next";
import { Suspense } from "react";
import PageShell from "@/components/dashboard/page-shell";
import AddEntry from "@/components/finance/add-entry";
import PlanSummary from "@/components/finance/budget/plan-summary";
import {
  budgetReport,
  formatMonth,
  monthRange,
  todayISO,
} from "@/lib/finance";
import {
  getBudget,
  getInvestmentEntries,
  getTransactions,
} from "@/lib/finance-queries";

export const metadata: Metadata = {
  title: "Overview · Day One",
};

export default async function OverviewPage() {
  const today = todayISO();
  const month = today.slice(0, 7);
  const range = monthRange(month);
  const [budget, transactions, investments] = await Promise.all([
    getBudget("month", month),
    getTransactions(range),
    getInvestmentEntries(range),
  ]);

  return (
    <PageShell title="Overview" description="Your life at a glance.">
      <Suspense fallback={<div className="h-12" />}>
        <AddEntry />
      </Suspense>
      <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
        <PlanSummary
          monthLabel={formatMonth(month)}
          report={
            budget
              ? budgetReport(
                  budget,
                  "month",
                  month,
                  { transactions, investments },
                  today,
                )
              : null
          }
        />
      </div>
    </PageShell>
  );
}
