import Link from "next/link";
import type { ReactNode } from "react";

// The shared look, taken from the Overview design: soft cards, hairline
// dividers, serif headings, 44px tap targets.

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-[18px] border border-paper/10 bg-surface ${
        padded ? "p-4 sm:p-5" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

// Rows split by hairlines, as in the habits and exercise cards
export function CardList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul
      className={`overflow-hidden rounded-[18px] border border-paper/10 bg-surface [&>li+li]:border-t [&>li+li]:border-paper/[0.06] ${className}`}
    >
      {children}
    </ul>
  );
}

// The dark panel used for "Today so far"
export function DarkCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl bg-paper px-4 py-3.5 text-ink ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHead({
  title,
  href,
  link,
  aside,
}: {
  title: string;
  href?: string;
  link?: string;
  aside?: string;
}) {
  return (
    <div className="-mb-2 mt-3 flex items-baseline justify-between gap-3">
      <h2 className="min-w-0 truncate font-serif text-[22px] sm:text-2xl">
        {title}
      </h2>
      {href && link ? (
        <Link
          href={href}
          className="shrink-0 text-[13px] font-semibold text-ember"
        >
          {link} →
        </Link>
      ) : (
        aside && (
          <span className="shrink-0 text-[13px] text-paper/45">{aside}</span>
        )
      )}
    </div>
  );
}

export function CardHead({
  title,
  aside,
  href,
  link,
}: {
  title: string;
  aside?: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="min-w-0 truncate font-serif text-xl">{title}</h3>
      {href && link ? (
        <Link href={href} className="shrink-0 text-[13px] font-semibold text-ember">
          {link} →
        </Link>
      ) : (
        aside && (
          <span className="shrink-0 text-xs text-paper/45">{aside}</span>
        )
      )}
    </div>
  );
}

// A label and a number, used in the money grids and report tiles
export function Figure({
  label,
  value,
  hint,
  tone,
  divide,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
  divide?: boolean;
}) {
  return (
    <div className={`min-w-0 py-3 ${divide ? "border-b border-paper/[0.06]" : ""}`}>
      <p className="truncate text-xs text-paper/55">{label}</p>
      <p
        className={`mt-0.5 truncate text-[19px] font-bold tabular-nums ${toneClass(tone)}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-paper/40">{hint}</p>}
    </div>
  );
}

// 2-up grid of figures inside one card
export function FigureGrid({
  items,
}: {
  items: {
    label: string;
    value: string;
    hint?: string;
    tone?: "good" | "bad";
  }[];
}) {
  return (
    <Card padded={false} className="px-4 py-1">
      <div className="grid grid-cols-2">
        {items.map((item, i) => (
          <Figure
            key={item.label}
            {...item}
            divide={i < items.length - 2}
          />
        ))}
      </div>
    </Card>
  );
}

export const toneClass = (tone?: "good" | "bad" | "muted") =>
  tone === "bad"
    ? "text-[#b3372e] dark:text-red-300"
    : tone === "good"
      ? "text-moss"
      : tone === "muted"
        ? "text-paper/45"
        : "";

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "bad" | "accent";
}) {
  const tones = {
    neutral: "bg-paper/[0.06] text-paper/60",
    good: "bg-moss/15 text-moss",
    bad: "bg-[#b3372e]/10 text-[#b3372e] dark:text-red-300",
    accent: "bg-ember/15 text-ember",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({
  children,
  href,
}: {
  children: ReactNode;
  href?: string;
}) {
  const className =
    "block rounded-[18px] border border-dashed border-paper/15 px-4 py-8 text-center text-sm text-paper/55";
  return href ? (
    <Link
      href={href}
      className={`${className} transition hover:border-ember/50 hover:text-paper`}
    >
      {children}
    </Link>
  ) : (
    <p className={className}>{children}</p>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink px-3 text-[15px] text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/10";

export const labelClass = "text-xs font-medium text-paper/55";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={labelClass}>
        {label}
        {hint && <span className="ml-1 text-paper/35">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const primaryButtonClass =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ember px-5 text-[15px] font-semibold text-on-ember shadow-sm transition-colors hover:bg-ember-light disabled:opacity-60";

export const quietButtonClass =
  "flex min-h-11 items-center justify-center rounded-xl border border-paper/15 px-4 text-sm font-medium transition hover:bg-paper/5 disabled:opacity-50";

// Placeholder blocks used by the loading screens
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[18px] bg-paper/[0.06] ${className}`}
      aria-hidden
    />
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-12 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={i % 2 ? "h-32" : "h-40"} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// A nudge row: emoji, one line, chevron
export function Reminder({
  href,
  emoji,
  title,
}: {
  href: string;
  emoji: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 flex-1 items-center gap-3 rounded-[14px] border border-paper/10 bg-surface px-4 py-3 transition active:bg-ink"
    >
      <span className="text-base">{emoji}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
      <span className="text-ember">→</span>
    </Link>
  );
}
