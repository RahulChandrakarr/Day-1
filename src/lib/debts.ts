// Borrow / lend ledger types and helpers (safe for server and client).
// Kept apart from income and expenses: borrowed money isn't income.

export type DebtKind = "borrowed" | "repaid" | "lent" | "received";

export const DEBT_KINDS: {
  kind: DebtKind;
  label: string; // form choice
  verb: string; // list line
  sign: 1 | -1; // effect on what I owe (+) / am owed (−)
}[] = [
  { kind: "borrowed", label: "I took", verb: "Took from", sign: 1 },
  { kind: "repaid", label: "I returned", verb: "Paid back", sign: -1 },
  { kind: "lent", label: "I gave", verb: "Gave to", sign: -1 },
  { kind: "received", label: "I got back", verb: "Got back from", sign: 1 },
];

export type Person = { id: string; name: string };

export type DebtEntry = {
  id: string;
  kind: DebtKind;
  amount: number;
  note: string | null;
  occurred_on: string; // YYYY-MM-DD
  created_at: string;
  in_balance: boolean; // counted in the day's net balance
  person: Person;
};

export type PersonBalance = Person & {
  owe: number; // I still owe them (borrowed − repaid), never below 0
  owed: number; // they still owe me (lent − received), never below 0
  entries: DebtEntry[]; // newest first
  lastOn: string | null;
};

export function personBalances(people: Person[], entries: DebtEntry[]) {
  const byId = new Map<string, PersonBalance>(
    people.map((p) => [
      p.id,
      { ...p, owe: 0, owed: 0, entries: [], lastOn: null },
    ]),
  );
  const sums = new Map<string, Record<DebtKind, number>>();
  for (const entry of entries) {
    const person = byId.get(entry.person.id);
    if (!person) continue;
    person.entries.push(entry);
    if (!person.lastOn || entry.occurred_on > person.lastOn)
      person.lastOn = entry.occurred_on;
    const s = sums.get(person.id) ?? {
      borrowed: 0,
      repaid: 0,
      lent: 0,
      received: 0,
    };
    s[entry.kind] += entry.amount;
    sums.set(person.id, s);
  }
  for (const [id, s] of sums) {
    const person = byId.get(id)!;
    // Over-repaying one way turns into the other direction
    const net = s.borrowed - s.repaid - (s.lent - s.received);
    person.owe = Math.max(net, 0);
    person.owed = Math.max(-net, 0);
  }
  return [...byId.values()]
    .map((p) => ({
      ...p,
      entries: p.entries.sort(
        (a, b) =>
          b.occurred_on.localeCompare(a.occurred_on) ||
          b.created_at.localeCompare(a.created_at),
      ),
    }))
    .sort(
      (a, b) =>
        b.owe + b.owed - (a.owe + a.owed) ||
        (b.lastOn ?? "").localeCompare(a.lastOn ?? ""),
    );
}

// Money returned to / received from each person in a set of entries.
export function debtFlows(entries: DebtEntry[]) {
  const repaid = new Map<string, number>();
  const received = new Map<string, number>();
  for (const e of entries) {
    if (e.kind === "repaid")
      repaid.set(e.person.id, (repaid.get(e.person.id) ?? 0) + e.amount);
    if (e.kind === "received")
      received.set(e.person.id, (received.get(e.person.id) ?? 0) + e.amount);
  }
  return { repaid, received };
}
