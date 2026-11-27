import PageShell from "@/components/dashboard/page-shell";
import { Arrive } from "@/components/ui/kit";
import {
  SettingsMenuButton,
  SettingsSidebar,
} from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <PageShell title="Settings" frame>
      <div className="flex items-start gap-4">
        <SettingsSidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center gap-2">
            <SettingsMenuButton />
          </div>
          <Arrive>{children}</Arrive>
        </div>
      </div>
    </PageShell>
  );
}
