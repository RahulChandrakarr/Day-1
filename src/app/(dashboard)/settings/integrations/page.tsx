import type { Metadata } from "next";
import GrowwCard from "@/components/settings/integrations/groww-card";
import SplitwiseCard, {
  type SplitwiseConnection,
} from "@/components/settings/integrations/splitwise-card";
import { requireProfile } from "@/lib/auth";
import { APP_TIMEZONE, LOCALE } from "@/lib/finance";
import { getPortfolioSync } from "@/lib/finance-queries";
import { growwConfigured } from "@/lib/groww";
import { getIntegrationKey } from "@/lib/integrations/keys";
import { timeAgo } from "@/lib/portfolio";
import { getSplitwiseUser } from "@/lib/splitwise";

export const metadata: Metadata = {
  title: "Integrations · Day One",
};

const sinceFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Is the saved key still good? Asked fresh each time the page opens.
async function splitwiseConnection(userId: string): Promise<SplitwiseConnection> {
  let saved;
  try {
    saved = await getIntegrationKey(userId, "splitwise");
  } catch {
    return {
      accountName: null,
      since: "an earlier visit",
      problem: "Couldn't check your Splitwise link just now. Refresh to try again.",
      keyRejected: false,
    };
  }
  if (!saved) return null;
  const user = await getSplitwiseUser(saved.secret);
  return {
    accountName: user.ok ? user.data.name : saved.accountName,
    since: sinceFormat.format(new Date(saved.connectedAt)),
    problem: user.ok ? null : user.error,
    keyRejected: !user.ok && Boolean(user.keyRejected),
  };
}

// Outside services, each linked by the person themselves. A new integration
// is one more row in the list.
export default async function IntegrationsPage() {
  const { profile } = await requireProfile();
  const [splitwise, sync] = await Promise.all([
    splitwiseConnection(profile.id),
    getPortfolioSync().catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-paper/75">
        Link services you already use, so their numbers show up in Day One. Each person
        links their own accounts.
      </p>
      <div className="flex flex-col gap-3">
        <SplitwiseCard connection={splitwise} />
        <GrowwCard
          configured={growwConfigured()}
          sync={sync}
          syncedLabel={timeAgo(sync?.synced_at ?? null)}
        />
      </div>
    </div>
  );
}
