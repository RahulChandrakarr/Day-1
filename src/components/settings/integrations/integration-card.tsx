import type { ReactNode } from "react";

export type IntegrationStatus = { label: string; tone: "on" | "off" | "warn" };

const tones = {
  on: "bg-moss/15 text-moss",
  off: "bg-paper/[0.06] text-paper/70",
  warn: "bg-[#b3372e]/10 text-[#b3372e] dark:text-red-300",
};

// One service on Settings -> Integrations: its mark, what it brings into
// Day One, whether it's linked, then the card's own controls. Every new
// integration gets one of these, so the page reads the same as it grows.
export default function IntegrationCard({
  letter,
  markClassName,
  name,
  description,
  status,
  children,
}: {
  letter: string;
  markClassName: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  children: ReactNode;
}) {
  return (
    <section className="card flex min-w-0 flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${markClassName}`}
        >
          {letter}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[19px] font-bold tracking-[-0.01em]">{name}</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[status.tone]}`}
            >
              {status.label}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-paper/70">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
