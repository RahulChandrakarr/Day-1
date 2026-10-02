"use client";

import { useState } from "react";
import { Card, CardGrid, Stack } from "@/components/ui/kit";
import { addMonths, formatMonth } from "@/lib/finance";
import PdfLink from "./pdf-link";

type Kind = "plan" | "finance" | "health" | "journal";

const REPORTS: { kind: Kind; emoji: string; title: string; about: string; yearly: boolean }[] = [
  {
    kind: "plan",
    emoji: "🎯",
    title: "Plan",
    about: "Goals with progress, week or month breakdown, every task done or pending, pinned notes.",
    yearly: true,
  },
  {
    kind: "finance",
    emoji: "💰",
    title: "Finance",
    about: "Income and spending by category, plan vs actual, borrow balances, savings, EMIs and all entries.",
    yearly: true,
  },
  {
    kind: "health",
    emoji: "💪",
    title: "Health",
    about: "Workouts, habits and streaks, weight and BMI, compared with the month before.",
    yearly: false,
  },
  {
    kind: "journal",
    emoji: "📝",
    title: "Journal",
    about: "Every journal page of the month: mood, priorities, gratitude, notes, wins and lessons.",
    yearly: false,
  },
];

export default function ReportsPanel({ today }: { today: string }) {
  return (
    <Stack>
      <p className="text-sm text-paper/55">
        Pick a period and download a PDF you can save, print or share.
      </p>
      <CardGrid layout="wide">
        {REPORTS.map((r) => (
          <ReportCard key={r.kind} report={r} today={today} />
        ))}
      </CardGrid>
    </Stack>
  );
}

function ReportCard({
  report,
  today,
}: {
  report: (typeof REPORTS)[number];
  today: string;
}) {
  const thisMonth = today.slice(0, 7);
  const thisYear = Number(today.slice(0, 4));
  const [byYear, setByYear] = useState(false);
  const [month, setMonth] = useState(thisMonth);
  const [year, setYear] = useState(thisYear);

  const months = Array.from({ length: 24 }, (_, i) => addMonths(thisMonth, -i));
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);
  const query = byYear ? `year=${year}` : `month=${month}`;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden>
          {report.emoji}
        </span>
        <div className="min-w-0">
          <h3 className="font-bold tracking-tight text-xl">{report.title}</h3>
          <p className="text-sm text-paper/55">{report.about}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {report.yearly && (
          <div role="radiogroup" aria-label="Period" className="flex shrink-0 rounded-xl border border-paper/10 bg-ink p-0.5 text-sm">
            {[
              { value: false, label: "Month" },
              { value: true, label: "Year" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={byYear === option.value}
                onClick={() => setByYear(option.value)}
                className={`h-10 rounded-[10px] px-3 font-medium transition ${
                  byYear === option.value ? "bg-surface text-paper shadow-sm" : "text-paper/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {byYear ? (
          <select
            value={year}
            aria-label="Year"
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-11 min-w-0 flex-1 rounded-xl border border-paper/10 bg-ink px-3 text-[15px]"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={month}
            aria-label="Month"
            onChange={(e) => setMonth(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-paper/10 bg-ink px-3 text-[15px]"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
        )}
      </div>

      <PdfLink href={`/api/reports/${report.kind}?${query}`} variant="button" />
    </Card>
  );
}
