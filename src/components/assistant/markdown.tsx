"use client";

import { Streamdown } from "streamdown";

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
    >
      {children}
    </Streamdown>
  );
}
