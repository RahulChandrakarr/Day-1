import { notFound } from "next/navigation";
import NoteEditor from "@/components/plan/note-editor";
import { getNote } from "@/lib/plan-queries";

export default async function NotePage({ params }: PageProps<"/plan/notes/[id]">) {
  const { id } = await params;
  if (id === "new") return <NoteEditor note={null} />;
  const note = await getNote(id);
  if (!note) notFound();
  return <NoteEditor key={note.id} note={note} />;
}
