import type { ReactNode } from "react";

// Part of a page that starts folded away behind one 44px row. A native
// <details>, so it opens without any script.
export default function Fold({
  title,
  aside,
  small = false,
  className = "",
  children,
}: {
  title: string;
  aside?: ReactNode;
  // A quiet "show more" row inside a card, rather than a card's own heading
  small?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={`group/fold min-w-0 ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span
          className={
            small
              ? "text-sm font-medium text-ember"
              : "min-w-0 truncate text-[19px] font-bold tracking-[-0.01em]"
          }
        >
          {title}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm text-paper/60">
          {aside}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className="transition-transform group-open/fold:rotate-180"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </summary>
      {children}
    </details>
  );
}
