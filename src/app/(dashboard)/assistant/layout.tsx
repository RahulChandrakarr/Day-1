import ChatProvider from "@/components/assistant/chat-provider";
import { requireProfile } from "@/lib/auth";

// The chat client only loads on this tab, not on every page.
export default async function AssistantLayout({
  children,
}: LayoutProps<"/assistant">) {
  const { profile } = await requireProfile();
  const name =
    profile.full_name?.split(" ")[0] ?? profile.email.split("@")[0] ?? "there";

  return <ChatProvider name={name}>{children}</ChatProvider>;
}
