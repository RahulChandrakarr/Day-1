import NotesBoard from "@/components/plan/notes-board";
import LoanPlan from "@/components/plan/loan-plan";
import { getNotes } from "@/lib/plan-queries";

export default async function PlanNotesPage() {
  const notes = await getNotes();

  return (
    <div className="flex flex-col gap-4">
      <LoanPlan />
      <NotesBoard notes={notes} />
    </div>
  );
}
