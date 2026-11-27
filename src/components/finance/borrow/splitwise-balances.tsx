import Link from "next/link";
import { Card } from "@/components/ui/kit";
import { requireProfile } from "@/lib/auth";
import { getIntegrationKey } from "@/lib/integrations/keys";
import {
  formatBalance,
  formatFetchedAt,
  getSplitwiseBalances,
  type Balance,
} from "@/lib/splitwise";

// Splitwise balances for the Borrow page, read live each time it opens. They
// are Splitwise's own figures, shown apart from the people kept in Day One and
// never added into the page's totals. Currencies are never converted.
export default async function SplitwiseBalances() {
  const { profile } = await requireProfile();

  let saved;
  try {
    saved = await getIntegrationKey(profile.id, "splitwise");
  } catch {
    return <Problem text="Couldn't check your Splitwise link just now. Refresh to try again." />;
  }

  if (!saved)
    return (
      <Link
        href="/settings/integrations"
        className="card flex items-center gap-3 rounded-inset px-4 py-3 text-sm text-paper/75 transition hover:text-paper"
      >
        <span className="min-w-0 flex-1">
          Use Splitwise? Link it in Settings → Integrations to see those balances here.
        </span>
        <span className="text-ember">→</span>
      </Link>
    );

  const result = await getSplitwiseBalances(saved.secret);
  if (!result.ok) return <Problem text={result.error} relink={result.keyRejected} />;

  const { open, settled, totals, fetchedAt } = result.data;
  const plural = (n: number) => (n === 1 ? "friend" : "friends");

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[19px] font-bold tracking-[-0.01em]">From Splitwise</h3>
        <span className="text-sm text-paper/70">
          as of {formatFetchedAt(fetchedAt)} ·{" "}
          <a
            href="https://secure.splitwise.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-ember hover:underline"
          >
            Open Splitwise ↗
          </a>
        </span>
      </div>
      <p className="mt-1 text-sm text-paper/70">
        {saved.accountName ? `${saved.accountName}'s` : "Your"} balances on Splitwise: each
        friend&apos;s total across all groups and bills. Not counted in the figures above.
      </p>

      {totals.length > 0 && (
        <dl className="mt-3 flex flex-col gap-1 text-sm">
          {totals.map((t) => (
            <div key={t.currency} className="flex flex-wrap gap-x-4 gap-y-0.5">
              {t.owedToYou > 0 && (
                <div className="flex gap-1.5">
                  <dt className="text-paper/70">Owed to you</dt>
                  <dd className="font-semibold text-moss">
                    {formatBalance(t.currency, t.owedToYou)}{" "}
                    <span className="font-normal text-paper/60">
                      ({t.owedBy} {plural(t.owedBy)})
                    </span>
                  </dd>
                </div>
              )}
              {t.youOwe > 0 && (
                <div className="flex gap-1.5">
                  <dt className="text-paper/70">You owe</dt>
                  <dd className="font-semibold text-chart-expense">
                    {formatBalance(t.currency, t.youOwe)}{" "}
                    <span className="font-normal text-paper/60">
                      ({t.owing} {plural(t.owing)})
                    </span>
                  </dd>
                </div>
              )}
            </div>
          ))}
        </dl>
      )}

      {open.length === 0 ? (
        <p className="mt-4 card rounded-inset px-4 py-8 text-center text-sm text-paper/70">
          All settled up on Splitwise.
        </p>
      ) : (
        <ul className="mt-3 grid items-start gap-2 lg:grid-cols-2 2xl:grid-cols-3">
          {open.map((friend) => (
            <li
              key={friend.id}
              className="flex items-center gap-3 rounded-inset border border-paper/10 bg-inset p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper/10 font-medium">
                {friend.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{friend.name}</span>
              <span className="flex shrink-0 flex-col items-end text-right text-sm font-semibold">
                {friend.balances.map((b) => (
                  <BalanceLine key={b.currency} balance={b} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {settled > 0 && open.length > 0 && (
        <p className="mt-3 text-sm text-paper/65">
          {settled} {plural(settled)} settled up.
        </p>
      )}
    </Card>
  );
}

function BalanceLine({ balance }: { balance: Balance }) {
  return balance.amount > 0 ? (
    <span className="text-moss">Owes you {formatBalance(balance.currency, balance.amount)}</span>
  ) : (
    <span className="text-chart-expense">
      You owe {formatBalance(balance.currency, -balance.amount)}
    </span>
  );
}

function Problem({ text, relink = false }: { text: string; relink?: boolean }) {
  return (
    <Card>
      <h3 className="text-[19px] font-bold tracking-[-0.01em]">From Splitwise</h3>
      <p role="alert" className="mt-2 text-sm text-[#b3372e] dark:text-red-300">
        {text}
      </p>
      {relink && (
        <Link
          href="/settings/integrations"
          className="mt-2 inline-block text-sm font-semibold text-ember hover:underline"
        >
          Paste a new key in Settings → Integrations →
        </Link>
      )}
    </Card>
  );
}
