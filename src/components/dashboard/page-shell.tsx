import type { ReactNode } from "react";

// Page header and content column, shared by every dashboard section.
export default function PageShell({
  title,
  description,
  children,
  hideMobileDescription = false,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  hideMobileDescription?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-5">
      <header className="hidden md:block">
        <h1 className="font-serif text-5xl">{title}</h1>
        {description && <p className="mt-1 text-paper/50">{description}</p>}
      </header>
      {description && !hideMobileDescription && (
        <p className="-mb-1 text-sm text-paper/50 md:hidden">{description}</p>
      )}

      {children ?? (
        <div className="flex min-h-80 flex-1 items-center justify-center rounded-[18px] border border-dashed border-paper/10 text-sm text-paper/35">
          Nothing here yet
        </div>
      )}
    </div>
  );
}
