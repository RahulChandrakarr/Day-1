import Link from "next/link";

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
  "flex h-10 w-10 items-center justify-center rounded-xl border border-paper/10 text-paper/70 transition hover:bg-paper/5 hover:text-paper";

// Prev / current / next navigation for a day, month or year.
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
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={prevHref} className={stepClass} aria-label="Previous">
        {arrow("left")}
      </Link>
      <h2 className="min-w-0 px-2 text-lg font-medium sm:text-xl">{label}</h2>
      <Link href={nextHref} className={stepClass} aria-label="Next">
        {arrow("right")}
      </Link>
      {!isCurrent && (
        <Link
          href={currentHref}
          className="h-10 rounded-xl border border-paper/10 px-3 text-sm leading-10 text-paper/70 transition hover:bg-paper/5 hover:text-paper"
        >
          {currentLabel}
        </Link>
      )}
      {children}
    </div>
  );
}
