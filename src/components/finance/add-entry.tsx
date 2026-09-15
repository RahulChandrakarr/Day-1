import { personBalances } from "@/lib/debts";
import {
  getAccounts,
  getCategories,
  getCategoryUsage,
  getDebts,
  getPeople,
} from "@/lib/finance-queries";
import EntryDialog from "./entry-dialog";

// "+ Add entry" button with everything the entry dialog needs.
export default async function AddEntry() {
  const [categories, usage, people, debts, accounts] = await Promise.all([
    getCategories(),
    getCategoryUsage(),
    getPeople(),
    getDebts(),
    getAccounts(),
  ]);

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
    />
  );
}
