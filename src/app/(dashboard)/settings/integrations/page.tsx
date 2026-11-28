import type { Metadata } from "next";
import AdzunaCard from "@/components/settings/integrations/adzuna-card";
import FreelancerCard, {
  type FreelancerConnection,
} from "@/components/settings/integrations/freelancer-card";
import GrowwCard from "@/components/settings/integrations/groww-card";
import InstagramCard, {
  type InstagramConnection,
} from "@/components/settings/integrations/instagram-card";
import SplitwiseCard, {
  type SplitwiseConnection,
} from "@/components/settings/integrations/splitwise-card";
import UpworkCard, { type UpworkConnection } from "@/components/settings/integrations/upwork-card";
import YoutubeCard, { type YoutubeConnection } from "@/components/settings/integrations/youtube-card";
import { requireProfile } from "@/lib/auth";
import { APP_TIMEZONE, LOCALE } from "@/lib/finance";
import { getPortfolioSync } from "@/lib/finance-queries";
import { getFreelancerSelf } from "@/lib/freelancer";
import { growwConfigured } from "@/lib/groww";
import { getInstagramSelf } from "@/lib/instagram";
import { getIntegrationKey } from "@/lib/integrations/keys";
import { adzunaConfigured } from "@/lib/jobs-fetch";
import { timeAgo } from "@/lib/portfolio";
import { getSplitwiseUser } from "@/lib/splitwise";
import { getUpworkSelf } from "@/lib/upwork";
import { pingYoutube, youtubeEnvKey } from "@/lib/youtube";

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
    return null;
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

async function freelancerConnection(userId: string): Promise<FreelancerConnection> {
  let saved;
  try {
    saved = await getIntegrationKey(userId, "freelancer");
  } catch {
    return null;
  }
  if (!saved) return null;
  const user = await getFreelancerSelf(saved.secret);
  return {
    accountName: user.ok ? user.data.name : saved.accountName,
    since: sinceFormat.format(new Date(saved.connectedAt)),
    problem: user.ok ? null : user.error,
    keyRejected: !user.ok && Boolean(user.keyRejected),
  };
}

async function youtubeConnection(userId: string): Promise<YoutubeConnection> {
  const envKey = youtubeEnvKey();
  if (envKey) {
    const ping = await pingYoutube(envKey);
    return {
      fromEnv: true,
      accountName: "YouTube Data API",
      since: null,
      problem: ping.ok ? null : ping.error,
      keyRejected: !ping.ok && Boolean(ping.keyRejected),
    };
  }
  let saved;
  try {
    saved = await getIntegrationKey(userId, "youtube");
  } catch {
    return null;
  }
  if (!saved) return null;
  const ping = await pingYoutube(saved.secret);
  return {
    fromEnv: false,
    accountName: saved.accountName,
    since: sinceFormat.format(new Date(saved.connectedAt)),
    problem: ping.ok ? null : ping.error,
    keyRejected: !ping.ok && Boolean(ping.keyRejected),
  };
}

async function instagramConnection(userId: string): Promise<InstagramConnection> {
  let saved;
  try {
    saved = await getIntegrationKey(userId, "instagram");
  } catch {
    return null;
  }
  if (!saved) return null;
  const user = await getInstagramSelf(saved.secret);
  return {
    accountName: user.ok ? `@${user.data.username}` : saved.accountName,
    since: sinceFormat.format(new Date(saved.connectedAt)),
    problem: user.ok ? null : user.error,
    keyRejected: !user.ok && Boolean(user.keyRejected),
  };
}

async function upworkConnection(userId: string): Promise<UpworkConnection> {
  let saved;
  try {
    saved = await getIntegrationKey(userId, "upwork");
  } catch {
    return null;
  }
  if (!saved) return null;
  const user = await getUpworkSelf(saved.secret);
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
  const [splitwise, freelancer, upwork, youtube, instagram, sync] = await Promise.all([
    splitwiseConnection(profile.id),
    freelancerConnection(profile.id),
    upworkConnection(profile.id),
    youtubeConnection(profile.id),
    instagramConnection(profile.id),
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
        <FreelancerCard connection={freelancer} />
        <UpworkCard connection={upwork} />
        <AdzunaCard configured={adzunaConfigured()} />
        <YoutubeCard connection={youtube} />
        <InstagramCard connection={instagram} />
      </div>
    </div>
  );
}
