import type { Metadata } from "next";
import { Suspense } from "react";
import PageShell from "@/components/dashboard/page-shell";
import AddEntry from "@/components/finance/add-entry";
import FinanceTabs from "@/components/finance/finance-tabs";

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
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <FinanceTabs />
          <Suspense fallback={<div className="h-12" />}>
            <AddEntry />
          </Suspense>
        </div>
        {children}
      </div>
    </PageShell>
  );
}
