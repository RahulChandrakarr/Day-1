"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Bottom sheet on phones, centred dialog on wider screens.
export default function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-[rgb(8_14_30/0.35)] backdrop-blur-[3px]"
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label={title}
              // Slide only: fading would switch the glass blur off mid-animation
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className={`pointer-events-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] card glass-strong shadow-2xl md:rounded-[28px] ${
                wide ? "md:max-w-2xl" : "md:max-w-lg"
              }`}
            >
              <header className="flex items-center gap-3 border-b border-paper/10 px-4 py-3 sm:px-5">
                <h2 className="min-w-0 flex-1 truncate font-bold tracking-tight text-xl sm:text-2xl">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-paper/50 transition hover:bg-paper/10 hover:text-paper"
                >
                  ×
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {children}
              </div>
              {footer && (
                <footer className="border-t border-paper/10 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 sm:px-5">
                  {footer}
                </footer>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
