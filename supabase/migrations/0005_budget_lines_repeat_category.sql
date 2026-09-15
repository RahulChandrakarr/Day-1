-- A plan can have several lines in the same category (e.g. Bills: rent, electricity).
-- note now holds the line's own label.

drop index if exists public.finance_budget_lines_unique_category;

comment on table public.finance_budget_lines is 'Planned expense lines within a budget. amount is INR. Several lines may share a category; actual spend = sum of expense finance_transactions with that category_id in the budget period, compared with the sum of its lines.';
comment on column public.finance_budget_lines.note is 'What the line is for, e.g. Rent or Laptop EMI';
