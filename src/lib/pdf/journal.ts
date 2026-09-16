import "server-only";
import { formatFullDate, formatMonth, monthRange } from "@/lib/finance";
import { ENERGY, MOODS } from "@/lib/journal";
import { getJournalRange } from "@/lib/journal-queries";
import { COLORS, ReportDoc } from "./report";

export async function journalReport(month: string) {
  const { from, to } = monthRange(month);
  const entries = await getJournalRange(from, to);
  const pdf = await ReportDoc.create("Journal", formatMonth(month));

  const moods = entries.map((e) => e.mood).filter((m): m is number => m !== null);
  const priorities = entries.flatMap((e) => e.priorities.filter((p) => p.text.trim()));
  pdf.stats([
    { label: "Days written", value: `${entries.length}` },
    {
      label: "Average mood",
      value: moods.length ? `${(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)} / 5` : "–",
    },
    {
      label: "Priorities done",
      value: `${priorities.filter((p) => p.done).length} / ${priorities.length}`,
    },
    {
      label: "Gratitude notes",
      value: `${entries.reduce((n, e) => n + e.gratitude.filter((g) => g.trim()).length, 0)}`,
    },
  ]);

  if (entries.length === 0) {
    pdf.empty("No journal pages this month.");
    return pdf.save();
  }

  for (const entry of entries) {
    const mood = MOODS.find((m) => m.value === entry.mood)?.label;
    const energy = entry.energy ? ENERGY[entry.energy - 1] : null;
    pdf.heading(
      formatFullDate(entry.entry_date),
      [mood && `Mood: ${mood}`, energy && `Energy: ${energy}`].filter(Boolean).join(" · "),
    );

    const todo = entry.priorities.filter((p) => p.text.trim());
    if (todo.length) {
      pdf.text("Priorities", { bold: true, size: 10 });
      for (const p of todo)
        pdf.text(`${p.done ? "✓" : "○"}  ${p.text}`, {
          indent: 8,
          color: p.done ? COLORS.moss : COLORS.ink,
        });
    }
    const gratitude = entry.gratitude.filter((g) => g.trim());
    if (gratitude.length) {
      pdf.text("Grateful for", { bold: true, size: 10 });
      for (const g of gratitude) pdf.text(`•  ${g}`, { indent: 8 });
    }
    const sections: [string, string][] = [
      ["Notes", entry.notes],
      ["Wins", entry.wins],
      ["Lessons", entry.lessons],
      ["Tomorrow", entry.tomorrow],
    ];
    for (const [title, body] of sections) {
      if (!body.trim()) continue;
      pdf.text(title, { bold: true, size: 10 });
      pdf.text(body.trim(), { indent: 8 });
    }
    pdf.space(4);
  }

  return pdf.save();
}
