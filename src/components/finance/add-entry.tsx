import { personBalances } from "@/lib/debts";
import { emiSummaries } from "@/lib/emis";
import { todayISO } from "@/lib/finance";
import {
  getAccounts,
  getBankAccounts,
  getCategories,
  getCategoryUsage,
  getDebts,
  getEmiPayments,
  getEmis,
  getPeople,
} from "@/lib/finance-queries";
import { isoWeekday } from "@/lib/health";
import {
  getCurrentBlock,
  getGymCheckins,
  getGymPlan,
  getHabitCheckins,
} from "@/lib/health-queries";
import { getHabits } from "@/lib/journal-queries";
import EntryDialog from "./entry-dialog";

// The app's one add-entry form, with everything it can log loaded for it.
// Rendered once by the dashboard layout; buttons open it through the Add hub.
export default async function AddEntry() {
  const today = todayISO();
  const [categories, usage, people, debts, accounts, emis, payments, habits, habitCheckins, gym, banks] =
    await Promise.all([
      getCategories(),
      getCategoryUsage(),
      getPeople(),
      getDebts(),
      getAccounts(),
      getEmis(),
      getEmiPayments(),
      getHabits(),
      getHabitCheckins(today, today),
      getCurrentBlock().then(async (block) => ({
        plan: await getGymPlan(block?.id ?? null),
        checkins: await getGymCheckins(today, today),
      })),
      getBankAccounts(today),
    ]);

  const day = gym.plan.find((d) => d.weekday === isoWeekday(today));
  const doneIds = gym.checkins[today] ?? [];
  const pending = day?.rest
    ? []
    : (day?.exercises ?? []).filter((e) => !doneIds.includes(e.id));

  return (
    <EntryDialog
      categories={categories}
      usage={usage}
      people={personBalances(people, debts).map(({ id, name, owe, owed }) => ({
        id,
        name,
        owe,
        owed,
      }))}
      accounts={accounts}
      emis={emiSummaries(emis, payments, today).map(
        ({ id, name, color, monthly_amount, remaining }) => ({
          id,
          name,
          color,
          monthly_amount,
          remaining,
        }),
      )}
      bankAccounts={banks.map(({ id, name, color, balance }) => ({ id, name, color, balance }))}
      habits={habits}
      habitCheckins={habitCheckins}
      workout={
        day && !day.rest && pending.length > 0
          ? {
              exercises: pending,
              doneIds,
              title: day.title || "Today's workout",
            }
          : null
      }
    />
  );
}
