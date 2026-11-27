import Link from "next/link";
import type { PortfolioSync } from "@/lib/portfolio";
import IntegrationCard, { type IntegrationStatus } from "./integration-card";

// Groww is linked with keys set on the server, not per person, so this card
// only reports on it: whether it's set up and how the last sync went.
export default function GrowwCard({
  configured,
  sync,
  syncedLabel,
}: {
  configured: boolean;
  sync: PortfolioSync | null;
  // "12 min ago", worked out on the server so it can't drift at hydration
  syncedLabel: string | null;
}) {
  const status: IntegrationStatus = !configured
    ? { label: "Not set up", tone: "off" }
    : sync?.status === "failed"
      ? { label: "Last sync failed", tone: "warn" }
      : { label: "Linked", tone: "on" };

  return (
    <IntegrationCard
      letter="G"
      markClassName="bg-ember/12 text-ember"
      name="Groww"
      description="Stocks in your Groww demat account, with live prices, on Savings → Stocks."
      status={status}
    >
      {configured ? (
        <div className="flex flex-col gap-3 text-sm text-paper/80">
          <p>
            {syncedLabel
              ? `Last synced ${syncedLabel}${sync ? ` · ${sync.holdings} ${sync.holdings === 1 ? "stock" : "stocks"}` : ""}.`
              : "Not synced yet."}{" "}
            Linked on the server, so it&apos;s one Groww account for the whole app.
          </p>
          {sync?.status === "failed" && sync.message && (
            <p role="alert" className="rounded-inset bg-[#b3372e]/10 px-3 py-2 text-[#b3372e] dark:text-red-300">
              {sync.message}
            </p>
          )}
          <Link
            href="/financial/savings/stocks"
            className="self-start font-semibold text-ember hover:underline"
          >
            Open Stocks to sync →
          </Link>
        </div>
      ) : (
        <p className="text-sm text-paper/80">
          Groww needs its keys added on the server before it can sync. Once they&apos;re
          there, this card shows when it last synced.
        </p>
      )}
    </IntegrationCard>
  );
}
