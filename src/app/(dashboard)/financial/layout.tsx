import type { Metadata } from "next";
import { Suspense } from "react";
import PageShell from "@/components/dashboard/page-shell";
import AddEntry from "@/components/finance/add-entry";
import {
  FinanceMenuButton,
  FinanceSidebar,
} from "@/components/finance/finance-nav";

export const metadata: Metadata = {
  title: "Financial · Day One",
};

export default function FinancialLayout({
  children,
}: LayoutProps<"/financial">) {
  return (
    <PageShell
      title="Financial"
      description="Income, spending and savings."
      hideMobileDescription
    >
      <div className="flex items-start gap-8">
        <FinanceSidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <FinanceMenuButton />
            <div className="flex min-w-0 flex-1 justify-end">
              <Suspense fallback={<div className="h-12" />}>
                <AddEntry />
              </Suspense>
            </div>
          </div>
          {children}
        </div>
      </div>
    </PageShell>
  );
}
