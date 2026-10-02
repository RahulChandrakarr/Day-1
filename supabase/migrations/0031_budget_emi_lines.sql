-- A plan line can now be an EMI, not just a category or a person.
--
-- Before this, an EMI had to be planned as a hand-typed category line: the
-- amount was a copy that went stale the moment the EMI changed, and the line
-- could never fill in, because installments live in finance_emi_payments and
-- the plan only counted expenses, borrow entries and savings. So "Chair EMI
-- ₹2,000 planned, ₹0 spent" stayed on the page after a ₹1,745 payment.
--
-- An EMI line takes its planned amount from the EMI itself, so changing the
-- installment changes the plan, and its actual from the payments recorded
-- against that EMI in the period.

alter table public.finance_budget_lines
  add column if not exists emi_id uuid references public.finance_emis (id) on delete cascade;

alter table public.finance_budget_lines
  drop constraint if exists finance_budget_lines_kind;
alter table public.finance_budget_lines
  add constraint finance_budget_lines_kind check (
    (kind = 'spend' and category_id is not null and person_id is null and emi_id is null)
    or (kind in ('repay', 'collect') and person_id is not null and category_id is null and emi_id is null)
    or (kind = 'emi' and emi_id is not null and category_id is null and person_id is null)
  );

create index if not exists finance_budget_lines_emi
  on public.finance_budget_lines (emi_id);

comment on table public.finance_budget_lines is
  'Planned lines within a budget. amount is INR. A spend line names a category and its actual is the expense transactions in that category; a repay or collect line names a person and its actual is the borrow entries with them; an emi line names an EMI, takes its planned amount from that EMI''s monthly_amount and its actual from finance_emi_payments in the period.';
comment on column public.finance_budget_lines.emi_id is
  'The EMI this line plans for; the installment amount comes from the EMI itself so it never goes stale';
