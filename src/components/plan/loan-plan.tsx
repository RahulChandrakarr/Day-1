import PaymentChecklist from "@/components/plan/payment-checklist";
import PayoffTable from "@/components/plan/payoff-table";
import { SectionHead } from "@/components/ui/kit";
import { getPaymentChecklist } from "@/lib/plan-queries";

export const LOAN_PLAN_TITLE = "Clear loans and Odessa trip";

// The payoff table and the boxes to tick, shown together in Plan.
export default async function LoanPlan({ month }: { month?: string }) {
  const payments = await getPaymentChecklist();
  if (payments.items.length === 0) return null;
  const done = payments.items.filter((item) => item.done).length;

  return (
    <>
      <SectionHead title="Loan payoff" aside="₹28,000 each month" />
      <PayoffTable month={month} />
      <SectionHead title="Checklist" aside={`${done}/${payments.items.length}`} />
      <PaymentChecklist goals={payments.goals} items={payments.items} />
    </>
  );
}
