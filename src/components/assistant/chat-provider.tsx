"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { AssistantUIMessage } from "@/lib/ai/types";

type ChatContextValue = ReturnType<typeof useChat<AssistantUIMessage>> & {
  conversationId: string;
  statusLabel: string | null;
  errorMessage: string | null;
  send: (text: string) => void;
  newChat: () => void;
  openConversation: (id: string) => Promise<void>;
  name: string;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useAssistant() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useAssistant must be used inside ChatProvider");
  return ctx;
}

function textOf(message: AssistantUIMessage | undefined) {
  return (
    message?.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("")
      .trim() ?? ""
  );
}

// Server errors arrive as JSON bodies ({ error }) inside Error.message.
function readError(error: Error | undefined) {
  if (!error) return null;
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // not JSON
  }
  return error.message || "Something went wrong. Please try again.";
}

// One chat for the whole dashboard, so a conversation survives tab changes.
export default function ChatProvider({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const [session, setSession] = useState<{
    id: string;
    initial: AssistantUIMessage[];
  }>(() => ({ id: crypto.randomUUID(), initial: [] }));
  const [statusLabel, setStatusLabel] = useState<string | null>(null);

  // The chat id doubles as the conversation id; only the new text is sent.
  const [transport] = useState(
    () =>
      new DefaultChatTransport<AssistantUIMessage>({
        api: "/api/assistant/chat",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            conversationId: id,
            text: textOf(messages.findLast((m) => m.role === "user")),
          },
        }),
      }),
  );

  const chat = useChat<AssistantUIMessage>({
    id: session.id,
    messages: session.initial,
    transport,
    onData: (part) => {
      if (part.type === "data-status") setStatusLabel(part.data.label);
    },
    onFinish: () => setStatusLabel(null),
    onError: () => setStatusLabel(null),
  });

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatusLabel("Thinking…");
    void chat.sendMessage({ text: trimmed });
  }

  function newChat() {
    void chat.stop();
    setStatusLabel(null);
    setSession({ id: crypto.randomUUID(), initial: [] });
  }

  async function openConversation(id: string) {
    void chat.stop();
    const res = await fetch(`/api/assistant/conversations/${id}`);
    if (!res.ok) return;
    const messages = (await res.json()) as AssistantUIMessage[];
    setStatusLabel(null);
    setSession({ id, initial: messages });
  }

  const value: ChatContextValue = {
    ...chat,
    conversationId: session.id,
    statusLabel,
    errorMessage: readError(chat.error),
    send,
    newChat,
    openConversation,
    name,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
