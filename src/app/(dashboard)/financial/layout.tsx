import type { Metadata } from "next";
import PageShell from "@/components/dashboard/page-shell";
import FinanceTabs from "@/components/finance/finance-tabs";

export const metadata: Metadata = {
  title: "Financial · Day One",
};

export default function FinancialLayout({
  children,
}: LayoutProps<"/financial">) {
  return (
    <PageShell title="Financial" description="Income, spending and savings.">
      <div className="flex flex-col gap-6">
        <FinanceTabs />
        {children}
      </div>
    </PageShell>
  );
}
