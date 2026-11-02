import ChatProvider from "@/components/assistant/chat-provider";
import { listPersonas } from "@/lib/ai/persona-queries";
import { getAssistantName } from "@/lib/assistant-memory";
import { requireProfile } from "@/lib/auth";

// The chat client only loads on this tab, not on every page.
export default async function AssistantLayout({
  children,
}: LayoutProps<"/assistant">) {
  const { profile, supabase } = await requireProfile();
  const [personas, assistantName] = await Promise.all([
    listPersonas(supabase),
    getAssistantName(supabase).catch(() => "Assistant"),
  ]);
  const name =
    profile.full_name?.split(" ")[0] ?? profile.email.split("@")[0] ?? "there";

  return (
    <ChatProvider name={name} assistantName={assistantName} personas={personas}>
      {children}
    </ChatProvider>
  );
}
