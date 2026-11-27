import PaymentChecklist from "@/components/plan/payment-checklist";
import PayoffTable from "@/components/plan/payoff-table";
import { Pill } from "@/components/ui/kit";
import { formatMonth } from "@/lib/finance";
import { getPaymentChecklist } from "@/lib/plan-queries";

export const LOAN_PLAN_TITLE = "Clear loans and Odessa trip";

// The loan payoff, folded into one line with what's paid; it opens to the
// boxes to tick and the month table. With a month, only that month's payments.
export default async function LoanPlan({ month }: { month?: string }) {
  const payments = await getPaymentChecklist();
  if (payments.items.length === 0) return null;
  const inMonth = month ? payments.items.filter((item) => item.period === month) : [];
  const items = inMonth.length > 0 ? inMonth : payments.items;
  const done = items.filter((item) => item.done).length;

  return (
    // The glass goes on a wrapper: <details> draws its own parts
    <section className="card">
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-card px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="text-xl" aria-hidden>
          💸
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold tracking-[-0.01em]">Loan payoff</span>
          <span className="block truncate text-xs text-paper/65">
            {inMonth.length > 0 ? `${formatMonth(month!)} payments` : "Every payment"} · ₹28,000 a month
          </span>
        </span>
        <Pill tone={done === items.length ? "good" : "neutral"}>
          {done}/{items.length} paid
        </Pill>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-paper/50 transition-transform group-open:rotate-180">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-4 border-t border-paper/10 px-4 pb-4 pt-3 sm:px-5">
        <PaymentChecklist goals={payments.goals} items={items} />
        <PayoffTable month={month} />
      </div>
    </details>
    </section>
  );
}
