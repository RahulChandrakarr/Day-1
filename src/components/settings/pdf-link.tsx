"use client";

import { useState } from "react";

// Downloads a report PDF, showing progress while it's built.
export default function PdfLink({
  href,
  variant = "link",
  label = "Download PDF",
}: {
  href: string;
  variant?: "link" | "button";
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function download() {
    if (state === "busy") return;
    setState("busy");
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const name =
        /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ??
        "day-one-report.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  const text =
    state === "busy" ? "Preparing…" : state === "error" ? "Couldn't make it. Retry" : label;

  if (variant === "button")
    return (
      <button
        type="button"
        onClick={download}
        disabled={state === "busy"}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ember text-[15px] font-semibold text-on-ember transition-colors hover:bg-ember-light disabled:opacity-60"
      >
        <DownloadIcon />
        {text}
      </button>
    );

  return (
    <button
      type="button"
      onClick={download}
      disabled={state === "busy"}
      className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-paper/10 bg-surface px-3 text-[13px] font-semibold transition active:bg-ink ${
        state === "error" ? "text-red-700 dark:text-red-300" : "text-ember"
      }`}
    >
      <DownloadIcon />
      {text}
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}
