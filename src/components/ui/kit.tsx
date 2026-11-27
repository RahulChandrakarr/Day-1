import Link from "next/link";
import type { ReactNode } from "react";

// The shared look: soft cards, hairline dividers, serif headings, 44px tap
// targets. Three weights of container, so a page can have a lead: Card for
// blocks of data, CardList for rows, DarkCard for the one thing that leads.
// CardGrid, Rail and Band arrange them.

export function Card({
  children,
  className = "",
  padded = true,
  container = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  // Lets the card's own contents respond to the card's width. Never set it on
  // a card holding a dialog or sheet: they would stop covering the window.
  container?: boolean;
}) {
  return (
    <section
      className={`card min-w-0 ${container ? "@container" : ""} ${padded ? "p-5" : ""} ${className}`}
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
      className={`card overflow-hidden [&>li+li]:border-t [&>li+li]:border-paper/[0.06] ${className}`}
    >
      {children}
    </ul>
  );
}

// The lead panel used for "Today so far": a warm nude gradient (sand to
// blush; deep mocha in dark mode). It re-points the colours its contents
// already use, so they read on it: ink text turns cocoa, ember accents and
// rings turn mocha, and paper chips turn cream.
export function DarkCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-card border border-white/70 bg-[radial-gradient(120%_90%_at_100%_0%,rgb(255_255_255/0.5),transparent_55%),linear-gradient(135deg,#f6e9de_0%,#ecd3c2_55%,#dfbba6_100%)] px-5 py-4 text-ink shadow-[0_18px_40px_-20px_rgb(138_92_76/0.55)] [--ember:#8a5c4c] [--ink:#3b2a21] [--on-ember:#ffffff] [--paper:#fffaf6] dark:border-white/10 dark:bg-[radial-gradient(120%_90%_at_100%_0%,rgb(255_255_255/0.12),transparent_55%),linear-gradient(135deg,#6b4c3f_0%,#5a3f34_55%,#47322a_100%)] dark:[--ember:#f0d3bf] dark:[--ink:#fff8f2] dark:[--on-ember:#3b2a21] dark:[--paper:#3b2a21] ${className}`}
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
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="min-w-0 truncate text-[26px] font-bold tracking-[-0.02em]">
        {title}
      </h2>
      {href && link ? (
        // Sits on the sky, so it gets a glass pill rather than bare blue text
        <Link
          href={href}
          className="shrink-0 rounded-full border border-glass-edge bg-glass px-3 py-1 text-[13px] font-semibold text-ember backdrop-blur-md transition hover:bg-glass-strong"
        >
          {link} →
        </Link>
      ) : (
        aside && (
          <span className="shrink-0 text-[13px] text-paper/65">{aside}</span>
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
      <h3 className="min-w-0 truncate text-[19px] font-bold tracking-[-0.01em]">{title}</h3>
      {href && link ? (
        <Link href={href} className="shrink-0 text-[13px] font-semibold text-indigo">
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

// Cards side by side once there is room. The column counts come from the
// space actually left after the sidebar and page padding: two columns need
// ~650px, three need ~985px, so a laptop gets two and a wide screen three.
const LAYOUTS = {
  // Ordinary cards
  pair: "lg:grid-cols-2",
  // Cards holding controls or a wide chart: they pair later
  wide: "xl:grid-cols-2",
  // Cards that hold a short list, so a third column still reads
  triple: "lg:grid-cols-2 2xl:grid-cols-3",
  // Small self-contained cards: habits, notes
  dense: "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
  // Figures, never one to a row
  tiles: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6",
} as const;

export function CardGrid({
  children,
  layout = "pair",
  align = "stretch",
  className = "",
}: {
  children: ReactNode;
  layout?: keyof typeof LAYOUTS;
  // Cards in a row share a height, so the row ends flush and the leftover
  // space sits inside a card rather than as a gap between cards. "start" is
  // for rows whose heights are wildly different.
  align?: "stretch" | "start";
  className?: string;
}) {
  const fill = align === "start" ? "items-start" : "items-stretch [&>*]:h-full";
  return (
    <div className={`grid min-w-0 gap-3 ${fill} ${LAYOUTS[layout]} ${className}`}>
      {children}
    </div>
  );
}

// A full-width row inside a CardGrid, for what can't be squeezed:
// wide tables and charts
export function Band({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`col-span-full min-w-0 ${className}`}>{children}</div>;
}

// A main column with a narrow one beside it. It splits at xl, not lg: at lg
// the main column would be left with about 370px, which is narrower than one
// column of a plain grid.
const RAILS = {
  xl: "xl:grid-cols-[minmax(0,1fr)_minmax(0,var(--rail))]",
  "2xl": "2xl:grid-cols-[minmax(0,1fr)_minmax(0,var(--rail))]",
} as const;

export function Rail({
  children,
  aside,
  at = "xl",
  className = "",
}: {
  children: ReactNode;
  aside: ReactNode;
  at?: keyof typeof RAILS;
  className?: string;
}) {
  return (
    <div className={`grid min-w-0 items-start gap-3 ${RAILS[at]} ${className}`}>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
      <div className="flex min-w-0 flex-col gap-3">{aside}</div>
    </div>
  );
}

// The one vertical rhythm between cards
export function Stack({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`flex min-w-0 flex-col gap-3 ${className}`}>{children}</div>;
}

// A heading with the cards it belongs to, so the space under a heading is
// always the same
export function Section({
  title,
  href,
  link,
  aside,
  children,
  className = "",
}: {
  title: string;
  href?: string;
  link?: string;
  aside?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex h-full min-w-0 flex-col gap-2 ${className}`}>
      <SectionHead title={title} href={href} link={link} aside={aside} />
      {/* The card under the heading takes the leftover height, so cards in a
          row end level; a footnote after it keeps its own height */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 [&>*:first-child]:flex-1">
        {children}
      </div>
    </section>
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
  // "mobile" keeps the row line only while the tiles wrap onto several rows;
  // "wrapped" drops it once they all fit on one
  divide?: boolean | "mobile" | "wrapped";
}) {
  const line = !divide
    ? ""
    : divide === "mobile"
      ? "border-b border-paper/[0.06] sm:border-b-0"
      : divide === "wrapped"
        ? "border-b border-paper/[0.06] @2xl:border-b-0"
        : "border-b border-paper/[0.06]";
  return (
    <div className={`min-w-0 py-2.5 ${line}`}>
      <p className="truncate text-xs text-paper/55">{label}</p>
      <p
        className={`mt-0.5 truncate text-[22px] font-bold tracking-[-0.01em] tabular-nums ${toneClass(tone)}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-paper/40">{hint}</p>}
    </div>
  );
}

// Numbers on the page itself, with no box around them. For pages that are
// mostly figures and lists, a card around every group is noise.
export function Figures({
  items,
  className = "",
}: {
  items: { label: string; value: string; hint?: string; tone?: "good" | "bad" }[];
  className?: string;
}) {
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="truncate text-xs text-paper/55">{item.label}</dt>
          <dd
            className={`mt-0.5 truncate text-[28px] font-bold tracking-[-0.02em] tabular-nums ${toneClass(item.tone)}`}
          >
            {item.value}
          </dd>
          {item.hint && <dd className="truncate text-xs text-paper/40">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

// A list separated by hairlines, without a card around it
export function Rows({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul className={`divide-y divide-paper/[0.06] border-y border-paper/[0.06] ${className}`}>
      {children}
    </ul>
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
    <Card padded={false} container className="px-4 py-1">
      <div className="grid grid-cols-2 @2xl:grid-cols-4">
        {items.map((item, i) => (
          <Figure
            key={item.label}
            {...item}
            divide={i < items.length - 2 ? "wrapped" : false}
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
    "card block px-4 py-8 text-center text-sm text-paper/45";
  return href ? (
    <Link
      href={href}
      className={`${className} transition hover:text-paper`}
    >
      {children}
    </Link>
  ) : (
    <p className={className}>{children}</p>
  );
}

export const inputClass =
  "h-12 w-full rounded-inset border border-transparent bg-inset px-4 text-[15px] text-paper outline-none transition placeholder:text-paper/35 focus:border-ember/60 focus:ring-4 focus:ring-ember/10";

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
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ember px-6 text-[15px] font-semibold text-on-ember shadow-[0_10px_24px_-10px_var(--ember)] transition-colors hover:bg-ember-light disabled:opacity-60";

export const quietButtonClass =
  "card flex min-h-11 items-center justify-center px-5 text-sm font-semibold transition hover:bg-paper/[0.03] disabled:opacity-50";

// Placeholder blocks used by the loading screens
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-card border border-glass-edge bg-glass ${className}`}
      aria-hidden
    />
  );
}

// The placeholder has to claim the same shape the page will take, or the
// content visibly jumps into columns when it arrives.
export function PageSkeleton({
  rows = 3,
  layout,
  rail = false,
}: {
  rows?: number;
  layout?: keyof typeof LAYOUTS;
  rail?: boolean;
}) {
  const blocks = Array.from({ length: rows }, (_, i) => (
    <Skeleton key={i} className={i % 2 ? "h-40" : "h-56"} />
  ));
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-11 max-w-xs rounded-inset" />
      <Skeleton className="h-20" />
      {rail ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,var(--rail))]">
          <Skeleton className="h-96" />
          <Skeleton className="h-56" />
        </div>
      ) : layout ? (
        <div className={`grid gap-3 ${LAYOUTS[layout]}`}>{blocks}</div>
      ) : (
        blocks
      )}
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
      className="flex min-h-11 flex-1 items-center gap-3 rounded-inset card px-4 py-3 transition active:bg-inset"
    >
      <span className="text-base">{emoji}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
      <span className="text-ember">→</span>
    </Link>
  );
}

// Small nudge chip, shown inside the Today card on Overview
export function ReminderChip({
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
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink/10 px-3 text-[13px] font-medium transition active:bg-ink/20"
    >
      <span>{emoji}</span>
      {title}
    </Link>
  );
}

const iconProps = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const PencilIcon = () => (
  <svg {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const TrashIcon = () => (
  <svg {...iconProps}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);
