"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAssistant } from "./chat-provider";
import { TrashIcon } from "./icons";

type Conversation = { id: string; title: string; updated_at: string };

const when = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default function ConversationList({ onClose }: { onClose: () => void }) {
  const { conversationId, openConversation, newChat } = useAssistant();
  const [items, setItems] = useState<Conversation[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/assistant/conversations")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Conversation[]) => active && setItems(data))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, []);

  async function remove(id: string) {
    setItems((list) => list?.filter((c) => c.id !== id) ?? null);
    await fetch(`/api/assistant/conversations/${id}`, { method: "DELETE" });
    if (id === conversationId) newChat();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-x-0 top-[3.25rem] z-20 max-h-80 origin-top overflow-y-auto card p-2 shadow-2xl shadow-black/10 dark:shadow-black/50"
    >
      <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-paper/45">
        Past chats
      </p>
      {items === null && (
        <p className="px-3 py-4 text-sm text-paper/40">Loading…</p>
      )}
      {items?.length === 0 && (
        <p className="px-3 py-4 text-sm text-paper/40">No saved chats yet.</p>
      )}
      <ul>
        {items?.map((c) => (
          <li key={c.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                void openConversation(c.id);
                onClose();
              }}
              className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-left transition hover:bg-paper/5 ${
                c.id === conversationId ? "bg-paper/5" : ""
              }`}
            >
              <span className="block truncate text-sm">{c.title}</span>
              <span className="block text-xs text-paper/40">
                {when.format(new Date(c.updated_at))}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void remove(c.id)}
              aria-label={`Delete chat "${c.title}"`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-paper/35 transition hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300"
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
