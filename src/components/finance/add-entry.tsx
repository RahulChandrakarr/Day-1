import { personBalances } from "@/lib/debts";
import { todayISO } from "@/lib/finance";
import {
  getAccounts,
  getCategories,
  getCategoryUsage,
  getDebts,
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

// "+ Add entry" button with everything the add sheet can log.
export default async function AddEntry() {
  const today = todayISO();
  const [categories, usage, people, debts, accounts, habits, habitCheckins, gym] =
    await Promise.all([
      getCategories(),
      getCategoryUsage(),
      getPeople(),
      getDebts(),
      getAccounts(),
      getHabits(),
      getHabitCheckins(today, today),
      getCurrentBlock().then(async (block) => ({
        plan: await getGymPlan(block?.id ?? null),
        checkins: await getGymCheckins(today, today),
      })),
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
