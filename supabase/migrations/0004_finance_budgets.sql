-- Budget plans: an estimate for a month or a year, compared later with actual entries.
-- Every row belongs to one user and is only visible to that user.

-- ---------------------------------------------------------------------------
-- Budgets (one per user, scope and period)
-- ---------------------------------------------------------------------------
create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope text not null check (scope in ('month', 'year')),
  -- YYYY-MM for a month plan, YYYY for a year plan
  period_key text not null,
  expected_income numeric(12, 2) check (expected_income >= 0),
  savings_target numeric(12, 2) check (savings_target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_budgets_period_key_format check (
    (scope = 'month' and period_key ~ '^\d{4}-(0[1-9]|1[0-2])$')
    or (scope = 'year' and period_key ~ '^\d{4}$')
  )
);

create unique index if not exists finance_budgets_unique_period
  on public.finance_budgets (user_id, scope, period_key);

alter table public.finance_budgets enable row level security;

drop policy if exists "Own budgets" on public.finance_budgets;
create policy "Own budgets"
  on public.finance_budgets for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Budget lines (planned spend per expense category)
-- ---------------------------------------------------------------------------
create table if not exists public.finance_budget_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  budget_id uuid not null references public.finance_budgets (id) on delete cascade,
  category_id uuid not null references public.finance_categories (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  note text check (length(note) <= 80),
  created_at timestamptz not null default now()
);

create unique index if not exists finance_budget_lines_unique_category
  on public.finance_budget_lines (budget_id, category_id);

alter table public.finance_budget_lines enable row level security;

drop policy if exists "Own budget lines" on public.finance_budget_lines;
create policy "Own budget lines"
  on public.finance_budget_lines for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.finance_budgets b
      where b.id = budget_id and b.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.finance_categories c
      where c.id = category_id and c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Save a whole plan atomically (runs as the caller, so RLS applies)
-- p_lines: [{ "category_id": uuid, "amount": number, "note": text|null }]
-- ---------------------------------------------------------------------------
create or replace function public.save_finance_budget(
  p_scope text,
  p_period_key text,
  p_expected_income numeric,
  p_savings_target numeric,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.finance_budgets (scope, period_key, expected_income, savings_target)
  values (p_scope, p_period_key, p_expected_income, p_savings_target)
  on conflict (user_id, scope, period_key) do update
    set expected_income = excluded.expected_income,
        savings_target = excluded.savings_target,
        updated_at = now()
  returning id into v_id;

  delete from public.finance_budget_lines where budget_id = v_id;

  insert into public.finance_budget_lines (budget_id, category_id, amount, note)
  select v_id, (l ->> 'category_id')::uuid, (l ->> 'amount')::numeric, nullif(l ->> 'note', '')
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as l;

  return v_id;
end;
$$;

revoke all on function public.save_finance_budget(text, text, numeric, numeric, jsonb) from public, anon;
grant execute on function public.save_finance_budget(text, text, numeric, numeric, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Descriptions the agent reads
-- ---------------------------------------------------------------------------
comment on table public.finance_budgets is 'Spending plans (estimates) for a month or a year. Compare with finance_transactions in the same period for plan vs actual.';
comment on column public.finance_budgets.scope is 'month or year';
comment on column public.finance_budgets.period_key is 'YYYY-MM when scope is month, YYYY when scope is year';
comment on column public.finance_budgets.expected_income is 'Planned income for the period in INR; null means not set';
comment on column public.finance_budgets.savings_target is 'Planned savings for the period in INR; actual savings = income - expense in that period';
comment on table public.finance_budget_lines is 'Planned expense per category within a budget. amount is INR. Actual spend = sum of expense finance_transactions with the same category_id in the budget period.';
comment on column public.finance_budget_lines.budget_id is 'References finance_budgets.id';
comment on column public.finance_budget_lines.category_id is 'References finance_categories.id (an expense category)';
comment on column public.finance_budget_lines.note is 'Optional short note, e.g. what the money is for';
