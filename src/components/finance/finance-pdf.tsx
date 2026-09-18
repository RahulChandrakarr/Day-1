"use client";

import { usePathname, useSearchParams } from "next/navigation";
import PdfLink from "@/components/settings/pdf-link";
import { parseMonthParam, parseYearParam } from "@/lib/finance";

// The PDF for the month or year on screen, shown beside Add entry.
export default function FinancePdf() {
  const pathname = usePathname();
  const params = useSearchParams();
  const size = "h-12 w-12 rounded-2xl";

  if (pathname.startsWith("/financial/monthly"))
    return (
      <PdfLink
        variant="icon"
        className={size}
        label="Month PDF"
        href={`/api/reports/finance?month=${parseMonthParam(params.get("month"))}`}
      />
    );
  if (pathname.startsWith("/financial/yearly"))
    return (
      <PdfLink
        variant="icon"
        className={size}
        label="Year PDF"
        href={`/api/reports/finance?year=${parseYearParam(params.get("year"))}`}
      />
    );
  return null;
}
