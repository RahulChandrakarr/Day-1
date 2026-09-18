import Link from "next/link";
import type { ReactNode } from "react";

const arrow = (dir: "left" | "right") => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
  </svg>
);

const stepClass =
  "flex h-11 w-11 items-center justify-center rounded-full border border-paper/10 bg-surface text-paper/60 transition hover:text-paper active:bg-ink";

// Prev / current / next for a day, month or year.
export default function PeriodNav({
  label,
  prevHref,
  nextHref,
  currentHref,
  isCurrent,
  currentLabel,
  children,
}: {
  label: string;
  prevHref: string;
  nextHref: string;
  currentHref: string;
  isCurrent: boolean;
  currentLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={prevHref} className={stepClass} aria-label="Previous">
        {arrow("left")}
      </Link>
      <h2 className="min-w-0 flex-1 px-1 font-serif text-[20px] leading-tight line-clamp-2 sm:text-[22px]">
        {label}
      </h2>
      <Link href={nextHref} className={stepClass} aria-label="Next">
        {arrow("right")}
      </Link>
      {!isCurrent && (
        <Link
          href={currentHref}
          className="flex h-11 items-center rounded-full border border-paper/10 bg-surface px-4 text-sm font-medium text-paper/70 transition hover:text-paper"
        >
          {currentLabel}
        </Link>
      )}
      {children}
    </div>
  );
}
