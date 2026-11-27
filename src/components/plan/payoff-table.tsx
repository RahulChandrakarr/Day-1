import Link from "next/link";
import { formatMoney } from "@/lib/finance";

const MONTHS = [
  { label: "Nov 2026", period: "2026-11" },
  { label: "Dec 2026", period: "2026-12" },
  { label: "Jan 2027", period: "2027-01" },
  { label: "Feb 2027", period: "2027-02" },
] as const;

const ROWS: { item: string; amounts: readonly number[] }[] = [
  { item: "Room rent", amounts: [3500, 3500, 3500, 3500] },
  { item: "Bijli", amounts: [250, 250, 250, 250] },
  { item: "Bike fuel and servicing", amounts: [2500, 2500, 2500, 2500] },
  { item: "Groceries", amounts: [2000, 2000, 2000, 2000] },
  { item: "Other", amounts: [1425, 3425, 4000, 4000] },
  { item: "Laptop EMI", amounts: [3580, 3580, 3580, 3580] },
  { item: "Chair EMI", amounts: [1745, 1745, 265, 0] },
  { item: "Vasu", amounts: [5000, 5000, 6354, 4124] },
  { item: "Naren sir", amounts: [3500, 3500, 3000, 0] },
  { item: "Rahul", amounts: [3000, 2500, 0, 0] },
  { item: "Vasu credit card", amounts: [1000, 0, 0, 0] },
  { item: "Pawn bhiya", amounts: [500, 0, 0, 0] },
  { item: "Gaurav", amounts: [0, 0, 2551, 0] },
  { item: "Saved", amounts: [0, 0, 0, 8046] },
];

const amount = (value: number) => (value ? formatMoney(value) : "—");

// The printed month table: every expense and payment, each column ₹28,000.
export default function PayoffTable({ month }: { month?: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-paper/10 bg-glass-strong">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-paper/10 text-left text-paper/50">
              <th className="px-4 py-2.5 font-medium">Item</th>
              {MONTHS.map((column) => (
                <th key={column.period} className="px-3 py-2.5 text-right font-medium">
                  <Link
                    href={`/plan/month?month=${column.period}`}
                    className={column.period === month ? "text-ember" : "hover:text-paper"}
                  >
                    {column.label}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.item} className="border-b border-paper/5">
                <th
                  scope="row"
                  className={`px-4 py-2 text-left font-normal ${row.item === "Vasu" ? "font-semibold" : ""}`}
                >
                  {row.item}
                </th>
                {row.amounts.map((value, index) => (
                  <td
                    key={MONTHS[index].period}
                    className={`px-3 py-2 text-right ${MONTHS[index].period === month ? "text-ember" : ""}`}
                  >
                    {amount(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-paper/15">
              <th scope="row" className="px-4 py-2.5 text-left">
                Total
              </th>
              {MONTHS.map((column) => (
                <td key={column.period} className="px-3 py-2.5 text-right font-semibold">
                  {formatMoney(28000)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-4 py-3 text-xs leading-relaxed text-paper/50">
        The ₹6,000 Odessa trip is included in Vasu, so he is owed ₹20,478. It is
        not a second bill. November other is ₹1,425 and December other is ₹3,425.
      </p>
    </div>
  );
}
