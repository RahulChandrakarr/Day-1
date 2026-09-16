import type { Metadata } from "next";
import DocumentsBoard from "@/components/settings/documents-board";
import { requireProfile } from "@/lib/auth";
import { getDocuments } from "@/lib/profile-queries";

export const metadata: Metadata = {
  title: "Documents · Day One",
};

export default async function DocumentsPage() {
  const [{ profile }, documents] = await Promise.all([requireProfile(), getDocuments()]);
  return <DocumentsBoard userId={profile.id} documents={documents} />;
}
