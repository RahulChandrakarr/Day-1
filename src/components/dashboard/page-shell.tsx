"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

// Shared page header + empty content area for dashboard sections.
export default function PageShell({
  title,
  description,
  children,
  hideMobileDescription = false,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  hideMobileDescription?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-1 flex-col gap-4 md:gap-6"
    >
      <header className="hidden md:block">
        <h1 className="font-serif text-5xl">{title}</h1>
        <p className="mt-1 text-paper/50">{description}</p>
      </header>
      {!hideMobileDescription && (
        <p className="text-paper/50 md:hidden">{description}</p>
      )}

      {children ?? (
        <div className="flex min-h-80 flex-1 items-center justify-center rounded-3xl border border-dashed border-paper/10 text-sm text-paper/30">
          Nothing here yet
        </div>
      )}
    </motion.div>
  );
}
