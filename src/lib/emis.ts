// EMI tracker types and helpers (safe for server and client).
// Remaining = total to repay minus payments. Not income or expense.

import { addMonths, daysInMonth } from "./finance";
import { ordinal } from "./investments";

export type Emi = {
  id: string;
  name: string;
  lender: string | null;
  total_amount: number;
  monthly_amount: number;
  start_on: string; // YYYY-MM-DD
  due_day: number;
  tenure_months: number | null;
  note: string | null;
  color: number;
};

export type EmiPayment = {
  id: string;
  emi_id: string;
  amount: number;
  note: string | null;
  occurred_on: string;
  created_at: string;
};

export type EmiSummary = Emi & {
  paid: number;
  remaining: number;
  monthsDone: number;
  monthsLeft: number;
  tenure: number | null; // original months, or done + left when unknown
  paidThisMonth: boolean;
  nextDueOn: string | null;
  overdue: boolean;
  payments: EmiPayment[]; // newest first
};

export function dueDateInMonth(month: string, dueDay: number) {
  const last = daysInMonth(month);
  return `${month}-${String(Math.min(dueDay, last)).padStart(2, "0")}`;
}

export function nextDueOn(
  dueDay: number,
  today: string,
  paidThisMonth: boolean,
  startOn?: string,
) {
  const month = today.slice(0, 7);
  let due = dueDateInMonth(paidThisMonth ? addMonths(month, 1) : month, dueDay);
  // First installment is the due day on or after the start date.
  if (startOn && due < startOn) {
    due = dueDateInMonth(startOn.slice(0, 7), dueDay);
    if (due < startOn) due = dueDateInMonth(addMonths(startOn.slice(0, 7), 1), dueDay);
  }
  return due;
}

export function dueDayLabel(dueDay: number) {
  return `${ordinal(dueDay)} of every month`;
}

export function emiSummaries(
  emis: Emi[],
  payments: EmiPayment[],
  today: string,
): EmiSummary[] {
  const month = today.slice(0, 7);
  const byId = new Map<string, EmiSummary>(
    emis.map((e) => [
      e.id,
      {
        ...e,
        paid: 0,
        remaining: e.total_amount,
        monthsDone: 0,
        monthsLeft: 0,
        tenure: e.tenure_months,
        paidThisMonth: false,
        nextDueOn: null,
        overdue: false,
        payments: [],
      },
    ]),
  );

  for (const payment of payments) {
    const emi = byId.get(payment.emi_id);
    if (!emi) continue;
    emi.payments.push(payment);
    emi.paid += payment.amount;
    if (payment.occurred_on.startsWith(month)) emi.paidThisMonth = true;
  }

  for (const emi of byId.values()) {
    emi.remaining = Math.max(Math.round((emi.total_amount - emi.paid) * 100) / 100, 0);
    const byAmount =
      emi.monthly_amount > 0 ? Math.floor(emi.paid / emi.monthly_amount) : 0;
    emi.monthsLeft =
      emi.remaining <= 0
        ? 0
        : Math.max(1, Math.ceil(emi.remaining / emi.monthly_amount));
    emi.tenure =
      emi.tenure_months ??
      (emi.remaining <= 0 ? byAmount : byAmount + emi.monthsLeft);
    emi.monthsDone =
      emi.remaining <= 0
        ? (emi.tenure ?? byAmount)
        : Math.min(byAmount, emi.tenure ?? byAmount);
    emi.nextDueOn =
      emi.remaining <= 0
        ? null
        : nextDueOn(emi.due_day, today, emi.paidThisMonth, emi.start_on);
    emi.overdue = Boolean(
      emi.nextDueOn && emi.nextDueOn < today && emi.remaining > 0,
    );
    emi.payments.sort(
      (a, b) =>
        b.occurred_on.localeCompare(a.occurred_on) ||
        b.created_at.localeCompare(a.created_at),
    );
  }

  return [...byId.values()].sort((a, b) => {
    const aOpen = a.remaining > 0 ? 0 : 1;
    const bOpen = b.remaining > 0 ? 0 : 1;
    return (
      aOpen - bOpen ||
      (a.nextDueOn ?? "").localeCompare(b.nextDueOn ?? "") ||
      a.name.localeCompare(b.name)
    );
  });
}
