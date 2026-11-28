import Link from "next/link";
import IntegrationCard, { type IntegrationStatus } from "./integration-card";

export default function AdzunaCard({ configured }: { configured: boolean }) {
  const status: IntegrationStatus = configured
    ? { label: "On", tone: "on" }
    : { label: "Not set up", tone: "off" };

  return (
    <IntegrationCard
      letter="A"
      markClassName="bg-paper/10 text-paper"
      name="Adzuna"
      description="India job search on the Jobs desk. Needs a free Adzuna app id and key on the server."
      status={status}
    >
      {configured ? (
        <p className="text-sm text-paper/80">
          Adzuna is on for the whole app. Openings from it mix into{" "}
          <Link href="/jobs" className="font-semibold text-ember hover:underline">
            Jobs
          </Link>
          .
        </p>
      ) : (
        <p className="text-sm text-paper/80">
          Register a free app at{" "}
          <a
            href="https://developer.adzuna.com/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-ember hover:underline"
          >
            developer.adzuna.com
          </a>{" "}
          and set <span className="font-mono text-xs">ADZUNA_APP_ID</span> and{" "}
          <span className="font-mono text-xs">ADZUNA_APP_KEY</span> on the server.
        </p>
      )}
    </IntegrationCard>
  );
}
