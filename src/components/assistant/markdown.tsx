"use client";

import { Streamdown } from "streamdown";

// Links inside the app (PDF reports, pages) open without the safety prompt
const linkSafety = {
  enabled: true,
  onLinkCheck: (url: string) => url.startsWith("/") && !url.startsWith("//"),
};

export default function Markdown({
  children,
  streaming = false,
}: {
  children: string;
  streaming?: boolean;
}) {
  return (
    <Streamdown
      className="assistant-md"
      mode={streaming ? "streaming" : "static"}
      isAnimating={streaming}
      controls={false}
      tableMaxHeight={480}
      linkSafety={linkSafety}
    >
      {children}
    </Streamdown>
  );
}
