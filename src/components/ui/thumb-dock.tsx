import type { ReactNode } from "react";

// The buttons used most, kept within thumb reach on phones: its children
// float in a glass bar just above the bottom tab bar, stopping short of the
// round assistant button on the right. From md up there's no thumb to serve,
// so the children simply stay where they are in the page.
//
// It's one set of buttons moved by CSS, not two copies: a second copy of
// "Add entry" would open a second form when the app shortcut asks for one.
// The forms these buttons open must go through <Portal>, or they'd be stuck
// inside this bar's layer.
export function ThumbDock({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`max-md:fixed max-md:bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] max-md:left-3 max-md:right-[5.25rem] max-md:z-30 max-md:rounded-[22px] max-md:border max-md:border-glass-edge max-md:bg-glass-strong max-md:p-1.5 max-md:shadow-[0_14px_36px_-20px_rgb(40_70_110/0.45)] max-md:backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

// Goes at the end of a page that has a ThumbDock, so the last of its content
// can scroll clear of the bar
export function ThumbDockSpacer() {
  return <div aria-hidden className="h-16 shrink-0 md:hidden" />;
}
