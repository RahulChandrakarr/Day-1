import type { Metadata } from "next";
import { Suspense } from "react";
import PageShell from "@/components/dashboard/page-shell";
import AddEntry from "@/components/finance/add-entry";
import FinancePdf from "@/components/finance/finance-pdf";
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
      description="Income, spending, savings and EMIs."
      hideMobileDescription
    >
      <div className="flex items-start gap-8">
        <FinanceSidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <FinanceMenuButton />
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <Suspense fallback={null}>
                <FinancePdf />
              </Suspense>
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
