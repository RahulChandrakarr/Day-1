import NotesBoard from "@/components/plan/notes-board";
import { getNotes } from "@/lib/plan-queries";

export default async function PlanNotesPage() {
  const notes = await getNotes();
  return <NotesBoard notes={notes} />;
}
