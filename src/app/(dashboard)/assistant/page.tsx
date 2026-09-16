import type { Metadata } from "next";
import ChatPanel from "@/components/assistant/chat-panel";
import PageShell from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "Assistant · Day One",
};

export default function AssistantPage() {
  return (
    <PageShell title="Assistant" description="Ask about your data.">
      <div className="mx-auto w-full max-w-3xl">
        <ChatPanel />
      </div>
    </PageShell>
  );
}
