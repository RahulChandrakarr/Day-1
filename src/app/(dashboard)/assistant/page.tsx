import type { Metadata } from "next";
import ChatPanel from "@/components/assistant/chat-panel";
import PageShell from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "Assistant · Day One",
};

export default function AssistantPage() {
  return (
    <PageShell title="Assistant">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <ChatPanel />
      </div>
    </PageShell>
  );
}
