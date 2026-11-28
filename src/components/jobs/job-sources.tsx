import {
  JOB_SOURCES,
  SOURCE_HOME,
  SOURCE_LABEL,
  type JobSource,
  type SourceState,
} from "@/lib/jobs";

export type BoardLink = {
  name: string | null;
  since?: string;
  problem?: string;
} | null;

const chip: Record<SourceState, string> = {
  ok: "border-moss/30 bg-moss/10 text-paper",
  off: "border-paper/10 bg-paper/[0.04] text-paper/55",
  fail: "border-[#b3372e]/25 bg-[#b3372e]/10 text-paper/80",
};

const dot: Record<SourceState, string> = {
  ok: "bg-moss",
  off: "bg-paper/35",
  fail: "bg-[#b3372e]",
};

function stateOf(
  source: JobSource,
  sources: Partial<Record<JobSource, SourceState>>,
  freelancer: BoardLink,
  upwork: BoardLink,
  adzunaOn: boolean,
): SourceState {
  if (source === "adzuna" && !adzunaOn) return "off";
  if (source === "freelancer") {
    if (!freelancer) return "off";
    if (freelancer.problem) return "fail";
    return sources.freelancer ?? "ok";
  }
  if (source === "upwork") {
    if (!upwork) return "off";
    if (upwork.problem) return "fail";
    return sources.upwork ?? "ok";
  }
  return sources[source] ?? "off";
}

export function SourceChips({
  sources,
  freelancer,
  upwork,
  adzunaOn,
}: {
  sources: Partial<Record<JobSource, SourceState>>;
  freelancer: BoardLink;
  upwork: BoardLink;
  adzunaOn: boolean;
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {JOB_SOURCES.map((source) => {
        const state = stateOf(source, sources, freelancer, upwork, adzunaOn);
        return (
          <li key={source}>
            <a
              href={SOURCE_HOME[source]}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${chip[state]}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${dot[state]}`} />
              {SOURCE_LABEL[source]}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function SourceNote() {
  return (
    <p className="px-1 text-xs text-paper/55">
      Listings from{" "}
      <a href="https://remoteok.com" className="underline" target="_blank" rel="noreferrer">
        Remote OK
      </a>
      ,{" "}
      <a href="https://remotive.com" className="underline" target="_blank" rel="noreferrer">
        Remotive
      </a>
      ,{" "}
      <a href="https://www.arbeitnow.com" className="underline" target="_blank" rel="noreferrer">
        Arbeitnow
      </a>
      ,{" "}
      <a href="https://jobicy.com" className="underline" target="_blank" rel="noreferrer">
        Jobicy
      </a>{" "}
      and{" "}
      <a href="https://himalayas.app" className="underline" target="_blank" rel="noreferrer">
        Himalayas
      </a>
      . Apply goes to the original posting. Fiverr, Naukri and PeoplePerHour have no public apply API, so they
      aren&apos;t here.
    </p>
  );
}
