"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

// Renders its children at the end of <body>. A dialog opened through this
// covers the whole window and stacks above everything, wherever its button
// sits: in a floating bar, a card, or anything that forms its own layer.
export default function Portal({ children }: { children: ReactNode }) {
  // False while rendering on the server, where there is no <body> to reach
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return inBrowser ? createPortal(children, document.body) : null;
}
