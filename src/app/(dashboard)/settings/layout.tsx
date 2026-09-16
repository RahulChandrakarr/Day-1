import PageShell from "@/components/dashboard/page-shell";
import SettingsNav from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <PageShell title="Settings">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
        <SettingsNav />
        <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
      </div>
    </PageShell>
  );
}
