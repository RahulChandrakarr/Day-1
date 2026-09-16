import "server-only";
import { personBalances } from "@/lib/debts";
import {
  budgetReport,
  categoryBreakdown,
  formatMoney,
  formatMonth,
  formatShortDate,
  monthBuckets,
  monthRange,
  todayISO,
  totalsOf,
  yearRange,
} from "@/lib/finance";
import {
  getAccounts,
  getBudget,
  getDebts,
  getInvestmentEntries,
  getPeople,
  getTransactions,
} from "@/lib/finance-queries";
import { accountKindLabel, accountSummaries, netSaved } from "@/lib/investments";
import { ReportDoc, type Cell } from "./report";

const signed = (value: number) =>
  `${value < 0 ? "−" : ""}${formatMoney(Math.abs(value))}`;

export async function financeReport(period: { month: string } | { year: number }) {
  const today = todayISO();
  const isMonth = "month" in period;
  const scope = isMonth ? "month" : "year";
  const key = isMonth ? period.month : String(period.year);
  const { from, to } = isMonth ? monthRange(period.month) : yearRange(period.year);
  const label = isMonth ? formatMonth(period.month) : key;

  const [transactions, budget, people, debts, accounts, allInvestments] = await Promise.all([
    getTransactions({ from, to }),
    getBudget(scope, key),
    getPeople(),
    getDebts(),
    getAccounts(),
    getInvestmentEntries(),
  ]);
  const periodDebts = debts.filter((d) => d.occurred_on >= from && d.occurred_on <= to);
  const periodInvestments = allInvestments.filter(
    (e) => e.occurred_on >= from && e.occurred_on <= to,
  );
  const totals = totalsOf(transactions);

  const pdf = await ReportDoc.create("Finance report", label);

  pdf.stats([
    { label: "Income", value: formatMoney(totals.income), tone: "good" },
    { label: "Spent", value: formatMoney(totals.expense), tone: "bad" },
    { label: "Net", value: signed(totals.net), tone: totals.net < 0 ? "bad" : "good" },
    { label: "Saved / invested", value: signed(netSaved(periodInvestments)), hint: "put in minus taken out" },
  ]);

  // Where the money went
  const spending = categoryBreakdown(transactions, "expense");
  pdf.heading("Spending by category", `${spending.length} categories`);
  if (spending.length === 0) pdf.empty("No spending logged.");
  else
    pdf.table(
      [
        { label: "Category", width: 3 },
        { label: "Amount", width: 1.4, align: "right" },
        { label: "Share", width: 0.8, align: "right" },
      ],
      spending.map((s) => [
        s.name,
        formatMoney(s.amount),
        `${Math.round((s.amount / (totals.expense || 1)) * 100)}%`,
      ]),
    );

  const income = categoryBreakdown(transactions, "income");
  if (income.length > 0) {
    pdf.heading("Income by category");
    pdf.table(
      [
        { label: "Category", width: 3 },
        { label: "Amount", width: 1.4, align: "right" },
      ],
      income.map((s) => [s.name, formatMoney(s.amount)]),
    );
  }

  // Plan vs actual
  if (budget) {
    const plan = budgetReport(
      budget,
      scope,
      key,
      { transactions, debts: periodDebts, investments: periodInvestments },
      today,
    );
    pdf.heading("Plan vs actual", `${formatMoney(plan.actual)} of ${formatMoney(plan.planned)} planned`);
    pdf.bar(
      "All planned spending",
      plan.planned ? plan.actual / plan.planned : null,
      `${Math.round((plan.actual / (plan.planned || 1)) * 100)}%`,
      plan.actual > plan.planned ? "bad" : undefined,
    );
    pdf.space(4);
    const rows: Cell[][] = [...plan.rows, ...plan.unplanned].map((row) => {
      const left = row.planned - row.actual;
      return [
        row.planned ? row.name : `${row.name} (not planned)`,
        formatMoney(row.planned),
        formatMoney(row.actual),
        { text: signed(left), tone: left < 0 ? "bad" : "good" },
      ];
    });
    if (rows.length)
      pdf.table(
        [
          { label: "Category", width: 2.6 },
          { label: "Planned", width: 1.2, align: "right" },
          { label: "Spent", width: 1.2, align: "right" },
          { label: "Left", width: 1.2, align: "right" },
        ],
        rows,
      );
    const extra: Cell[][] = [];
    if (plan.income.expected !== null)
      extra.push(["Income", formatMoney(plan.income.expected), formatMoney(plan.income.actual)]);
    if (plan.savings.target !== null)
      extra.push(["Savings", formatMoney(plan.savings.target), formatMoney(plan.savings.actual)]);
    for (const r of plan.repay) extra.push([`Return to ${r.name}`, formatMoney(r.planned), formatMoney(r.actual)]);
    for (const r of plan.collect) extra.push([`Get back from ${r.name}`, formatMoney(r.planned), formatMoney(r.actual)]);
    if (extra.length) {
      pdf.space(6);
      pdf.table(
        [
          { label: "Other plan lines", width: 2.6 },
          { label: "Planned", width: 1.2, align: "right" },
          { label: "Actual", width: 1.2, align: "right" },
        ],
        extra,
      );
    }
  }

  // Month by month for a year
  if (!isMonth) {
    pdf.heading("Month by month");
    pdf.table(
      [
        { label: "Month", width: 2 },
        { label: "Income", width: 1.3, align: "right" },
        { label: "Spent", width: 1.3, align: "right" },
        { label: "Net", width: 1.3, align: "right" },
      ],
      monthBuckets(period.year, transactions).map((b) => {
        const net = b.income - b.expense;
        return [
          b.title,
          formatMoney(b.income),
          formatMoney(b.expense),
          { text: signed(net), tone: net < 0 ? "bad" : net > 0 ? "good" : undefined },
        ];
      }),
    );
  }

  // Borrowing, as of today
  const balances = personBalances(people, debts).filter((p) => p.owe > 0 || p.owed > 0);
  pdf.heading("Borrow balances", "as of today");
  if (balances.length === 0) pdf.empty("Nothing owed either way.");
  else
    pdf.table(
      [
        { label: "Person", width: 2.6 },
        { label: "I owe", width: 1.3, align: "right" },
        { label: "Owes me", width: 1.3, align: "right" },
      ],
      balances.map((p) => [
        p.name,
        { text: p.owe ? formatMoney(p.owe) : "–", tone: p.owe ? "bad" : undefined },
        { text: p.owed ? formatMoney(p.owed) : "–", tone: p.owed ? "good" : undefined },
      ]),
    );

  // Savings & investments, as of today
  const summaries = accountSummaries(accounts, allInvestments);
  if (summaries.length > 0) {
    const worth = summaries.reduce((sum, a) => sum + a.current, 0);
    pdf.heading("Savings & investments", `worth ${formatMoney(worth)} today`);
    pdf.table(
      [
        { label: "Account", width: 2.2 },
        { label: "Type", width: 1.4 },
        { label: "Put in", width: 1.2, align: "right" },
        { label: "Worth", width: 1.2, align: "right" },
        { label: "Gain", width: 1.1, align: "right" },
      ],
      summaries.map((a) => [
        a.sip_amount ? `${a.name} (SIP ${formatMoney(a.sip_amount)})` : a.name,
        accountKindLabel(a.kind),
        formatMoney(a.invested),
        formatMoney(a.current),
        { text: signed(a.gain), tone: a.gain < 0 ? "bad" : a.gain > 0 ? "good" : undefined },
      ]),
    );
  }

  // Every entry, for a month
  if (isMonth) {
    pdf.heading("All entries", `${transactions.length}`);
    if (transactions.length === 0) pdf.empty("No entries.");
    else
      pdf.table(
        [
          { label: "Date", width: 1.3 },
          { label: "Category", width: 1.6 },
          { label: "Description", width: 2.6 },
          { label: "Amount", width: 1.2, align: "right" },
        ],
        [...transactions]
          .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
          .map((t) => [
            formatShortDate(t.occurred_on),
            t.category?.name ?? "–",
            t.description ?? "",
            {
              text: `${t.type === "income" ? "+" : "−"}${formatMoney(t.amount)}`,
              tone: t.type === "income" ? "good" : undefined,
            },
          ]),
        { size: 9 },
      );
  }

  return pdf.save();
}
