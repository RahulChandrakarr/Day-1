import type { Metadata } from "next";
import JobDesk from "@/components/jobs/job-desk";
import PageShell from "@/components/dashboard/page-shell";
import { requireProfile } from "@/lib/auth";
import { APP_TIMEZONE, LOCALE } from "@/lib/finance";
import { getFreelancerSelf } from "@/lib/freelancer";
import { getIntegrationKey } from "@/lib/integrations/keys";
import { adzunaConfigured, searchJobs } from "@/lib/jobs-fetch";
import { getSavedJobs } from "@/lib/jobs-queries";
import { getUpworkSelf } from "@/lib/upwork";

export const metadata: Metadata = {
  title: "Jobs · Day One",
};

const sinceFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "short",
});

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const { profile } = await requireProfile();
  const query = String((await searchParams).q ?? "").trim().slice(0, 120);

  const [freelancerKey, upworkKey] = await Promise.all([
    getIntegrationKey(profile.id, "freelancer").catch(() => null),
    getIntegrationKey(profile.id, "upwork").catch(() => null),
  ]);

  const [search, saved, freelancer, upwork] = await Promise.all([
    searchJobs(query, {
      freelancer: freelancerKey?.secret,
      upwork: upworkKey?.secret,
    }),
    getSavedJobs().catch(() => []),
    freelancerKey
      ? getFreelancerSelf(freelancerKey.secret).then((r) =>
          r.ok
            ? { name: r.data.name, since: sinceFormat.format(new Date(freelancerKey.connectedAt)) }
            : { name: freelancerKey.accountName, problem: r.error },
        )
      : Promise.resolve(null),
    upworkKey
      ? getUpworkSelf(upworkKey.secret).then((r) =>
          r.ok
            ? { name: r.data.name, since: sinceFormat.format(new Date(upworkKey.connectedAt)) }
            : { name: upworkKey.accountName, problem: r.error },
        )
      : Promise.resolve(null),
  ]);

  return (
    <PageShell title="Jobs" description="Openings from boards that publish them. Apply where they allow it.">
      <JobDesk
        query={query}
        listings={search.listings}
        sources={search.sources}
        saved={saved}
        freelancer={freelancer}
        upwork={upwork}
        adzunaOn={adzunaConfigured()}
      />
    </PageShell>
  );
}
