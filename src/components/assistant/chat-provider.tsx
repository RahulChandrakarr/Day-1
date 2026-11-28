"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { setTheme } from "@/components/theme";
import { DEFAULT_PERSONA_ID, type Persona } from "@/lib/ai/personas";
import type { AssistantUIMessage } from "@/lib/ai/types";

const PERSONA_KEY = "assistant-persona";

type FinishListener = (reply: { text: string; isError: boolean }) => void;

export type ChatMode = "ask" | "talk";

type ChatContextValue = ReturnType<typeof useChat<AssistantUIMessage>> & {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  personas: Persona[];
  persona: Persona;
  // Starts a new chat with this persona
  choosePersona: (id: string) => void;
  // Called when a reply has finished (used by Talk mode)
  onReplyFinished: (listener: FinishListener) => () => void;
  conversationId: string;
  // Who the user is talking to: the assistant's own name, or the persona's
  speakerName: string;
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

export function textOf(message: AssistantUIMessage | undefined) {
  return (
    message?.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("")
      .trim() ?? ""
  );
}

// Server errors arrive as JSON bodies ({ error }) inside Error.message.
export function readError(error: Error | undefined) {
  if (!error) return null;
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // not JSON
  }
  return error.message || "Something went wrong. Please try again.";
}

// The chat id doubles as the conversation id; only the new text is sent.
// mode, personaId and source come with each send / regenerate call.
export function assistantTransport() {
  return new DefaultChatTransport<AssistantUIMessage>({
    api: "/api/assistant/chat",
    prepareSendMessagesRequest: ({ id, messages, body }) => ({
      body: {
        ...body,
        conversationId: id,
        text: textOf(messages.findLast((m) => m.role === "user")),
      },
    }),
  });
}

// One chat for the whole dashboard, so a conversation survives tab changes.
function savedPersona(personas: Persona[]) {
  try {
    const id = localStorage.getItem(PERSONA_KEY);
    if (id && personas.some((p) => p.id === id)) return id;
  } catch {
    // storage unavailable
  }
  return DEFAULT_PERSONA_ID;
}

export default function ChatProvider({
  name,
  assistantName,
  personas,
  children,
}: {
  name: string;
  assistantName: string;
  personas: Persona[];
  children: ReactNode;
}) {
  const [session, setSession] = useState<{
    id: string;
    initial: AssistantUIMessage[];
  }>(() => ({ id: crypto.randomUUID(), initial: [] }));
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [mode, setModeState] = useState<ChatMode>("ask");
  const [personaId, setPersonaId] = useState(() =>
    typeof window === "undefined" ? DEFAULT_PERSONA_ID : savedPersona(personas),
  );
  const finishListeners = useRef(new Set<FinishListener>());
  const setMode = (next: ChatMode) => setModeState(next);
  const router = useRouter();
  // Set when the assistant changed data, so pages refresh after the answer
  const dataChanged = useRef(false);

  const [transport] = useState(assistantTransport);

  const chat = useChat<AssistantUIMessage>({
    id: session.id,
    messages: session.initial,
    transport,
    onData: (part) => {
      if (part.type === "data-status") setStatusLabel(part.data.label);
      if (part.type === "data-action") {
        if (part.data.kind === "theme") setTheme(part.data.value);
        else dataChanged.current = true;
      }
    },
    onFinish: ({ message, isError }) => {
      setStatusLabel(null);
      const text = message.parts
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim();
      // A reply that already has words is still a reply, even if the stream
      // ended roughly (save failed, length cap). Don't scare them with "try again".
      for (const listener of finishListeners.current)
        listener({ text, isError: isError && !text });
      if (dataChanged.current) {
        dataChanged.current = false;
        router.refresh();
      }
    },
    onError: () => setStatusLabel(null),
  });

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatusLabel("Thinking…");
    void chat.sendMessage({ text: trimmed }, { body: { mode, personaId } });
  }

  function applyPersona(id: string) {
    const known = personas.some((p) => p.id === id) ? id : DEFAULT_PERSONA_ID;
    setPersonaId(known);
    return known;
  }

  function newChat() {
    void chat.stop();
    setStatusLabel(null);
    setSession({ id: crypto.randomUUID(), initial: [] });
  }

  function choosePersona(id: string) {
    const known = applyPersona(id);
    try {
      localStorage.setItem(PERSONA_KEY, known);
    } catch {
      // storage unavailable
    }
    newChat();
  }

  async function openConversation(id: string) {
    void chat.stop();
    const res = await fetch(`/api/assistant/conversations/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { persona: string; messages: AssistantUIMessage[] };
    applyPersona(data.persona);
    setStatusLabel(null);
    setSession({ id, initial: data.messages });
  }

  const onReplyFinished = useCallback((listener: FinishListener) => {
    const listeners = finishListeners.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const persona = personas.find((p) => p.id === personaId) ?? personas[0];
  const value: ChatContextValue = {
    ...chat,
    regenerate: (options) => chat.regenerate({ ...options, body: { mode, personaId, ...options?.body } }),
    mode,
    setMode,
    personas,
    persona,
    speakerName: persona.id === DEFAULT_PERSONA_ID ? assistantName : persona.name,
    choosePersona,
    onReplyFinished,
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
