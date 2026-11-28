"use client";

export default function SaveBtn({
  saved,
  pending,
  onSave,
}: {
  saved: boolean;
  pending: boolean;
  onSave: () => void;
}) {
  if (saved) return <span className="shrink-0 text-[11px] font-semibold text-ember">Saved</span>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onSave}
      className="shrink-0 text-[11px] font-semibold text-ember hover:underline"
    >
      Save
    </button>
  );
}
