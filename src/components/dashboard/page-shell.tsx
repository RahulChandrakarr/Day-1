import type { ReactNode } from "react";
import { Arrive } from "@/components/ui/kit";

// Page header and content column, shared by every dashboard section.
export default function PageShell({
  title,
  description,
  children,
  hideMobileDescription = false,
  frame = false,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  hideMobileDescription?: boolean;
  // Set by a section's layout, whose shell (tabs, menus) stays on screen while
  // its pages change: the shell holds still, and the layout wraps the page it
  // is handed in <Arrive> itself. Without it the shell belongs to one page,
  // and its content eases into place when the page arrives.
  frame?: boolean;
}) {
  const content = children ?? (
    <div className="flex min-h-80 flex-1 items-center justify-center card text-sm text-paper/50">
      Nothing here yet
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <header className="hidden md:block">
        <h1 className="font-bold tracking-tight text-4xl xl:text-5xl">{title}</h1>
        {description && <p className="mt-1 text-paper/78">{description}</p>}
      </header>
      {description && !hideMobileDescription && (
        <p className="-mb-1 text-sm text-paper/78 md:hidden">{description}</p>
      )}

      {frame ? content : <Arrive>{content}</Arrive>}
    </div>
  );
}
