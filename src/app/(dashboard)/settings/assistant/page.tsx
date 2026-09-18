import type { Metadata } from "next";
import AssistantSettings from "@/components/settings/assistant-settings";
import { getAssistantName, getMemories } from "@/lib/assistant-memory";

export const metadata: Metadata = {
  title: "Assistant · Day One",
};

export default async function AssistantSettingsPage() {
  const [name, memories] = await Promise.all([getAssistantName(), getMemories()]);
  return <AssistantSettings name={name} memories={memories} />;
}
