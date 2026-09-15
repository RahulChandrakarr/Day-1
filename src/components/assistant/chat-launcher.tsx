"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ChatPanel from "./chat-panel";
import { useAssistant } from "./chat-provider";
import { SparkleIcon } from "./icons";

// Floating button + slide-over chat on every tab except Overview.
export default function ChatLauncher() {
  const pathname = usePathname();
  const { sheetOpen, setSheetOpen, status } = useAssistant();
  const onOverview = pathname === "/";
  const open = sheetOpen && !onOverview;
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setSheetOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setSheetOpen]);

  return (
    <>
      <AnimatePresence>
        {!onOverview && !open && (
          <motion.button
            type="button"
            onClick={() => setSheetOpen(true)}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            aria-label="Open assistant"
            className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ember text-on-ember shadow-xl shadow-black/20 md:right-8 md:bottom-8"
          >
            {busy && (
              <span className="absolute inset-0 animate-ping rounded-full bg-ember/40" />
            )}
            <SparkleIcon size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 z-50 hidden bg-black/30 backdrop-blur-[2px] md:block"
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Assistant"
              initial={{ y: "100%", opacity: 0.6 }}
              animate={{ y: 0, x: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.6 }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed inset-0 z-50 flex flex-col bg-ink pt-[env(safe-area-inset-top,0px)] md:inset-y-3 md:left-auto md:right-3 md:w-[440px] md:overflow-hidden md:rounded-3xl md:border md:border-paper/10 md:pt-0 md:shadow-2xl"
            >
              <ChatPanel variant="sheet" onClose={() => setSheetOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
