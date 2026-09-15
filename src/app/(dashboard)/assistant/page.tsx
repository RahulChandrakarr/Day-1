import type { Metadata } from "next";
import BriefingCard from "@/components/assistant/briefing-card";
import ChatPanel from "@/components/assistant/chat-panel";
import PageShell from "@/components/dashboard/page-shell";
import { todayISO } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Assistant · Day One",
};

export default async function AssistantPage() {
  const supabase = await createClient();
  const { data: briefing } = await supabase
    .from("ai_briefings")
    .select("content, updated_at")
    .eq("for_date", todayISO())
    .maybeSingle();

  return (
    <PageShell title="Assistant" description="Ask about your data.">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="order-2 lg:order-1">
          <BriefingCard
            initial={
              briefing
                ? { content: briefing.content, updatedAt: briefing.updated_at }
                : null
            }
          />
        </div>
        <div className="order-1 lg:order-2">
          <ChatPanel />
        </div>
      </div>
    </PageShell>
  );
}
