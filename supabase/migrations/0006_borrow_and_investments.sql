-- Borrow/lend ledger per person, savings & investment accounts,
-- and budget lines that plan repayments/collections.
-- Every row belongs to one user and is only visible to that user.

-- Same as 0005 (safe to repeat): categories may repeat across plan lines
drop index if exists public.finance_budget_lines_unique_category;

-- ---------------------------------------------------------------------------
-- People you borrow from or lend to
-- ---------------------------------------------------------------------------
create table if not exists public.finance_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create unique index if not exists finance_people_unique_name
  on public.finance_people (user_id, lower(name));

alter table public.finance_people enable row level security;

drop policy if exists "Own people" on public.finance_people;
create policy "Own people"
  on public.finance_people for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Borrow / lend entries
-- ---------------------------------------------------------------------------
create table if not exists public.finance_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id uuid not null references public.finance_people (id) on delete cascade,
  -- borrowed: I took money · repaid: I returned it · lent: I gave money · received: they returned it
  kind text not null check (kind in ('borrowed', 'repaid', 'lent', 'received')),
  amount numeric(12, 2) not null check (amount > 0),
  note text check (length(note) <= 200),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists finance_debts_user_date
  on public.finance_debts (user_id, occurred_on desc);

alter table public.finance_debts enable row level security;

drop policy if exists "Own debts" on public.finance_debts;
create policy "Own debts"
  on public.finance_debts for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.finance_people p
      where p.id = person_id and p.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Savings & investment accounts
-- ---------------------------------------------------------------------------
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  kind text not null default 'other' check (
    kind in ('savings', 'fd', 'rd', 'mutual_fund', 'stocks', 'ppf', 'epf', 'nps', 'gold', 'crypto', 'real_estate', 'other')
  ),
  color smallint not null default 1 check (color between 1 and 8),
  created_at timestamptz not null default now()
);

create unique index if not exists finance_accounts_unique_name
  on public.finance_accounts (user_id, lower(name));

alter table public.finance_accounts enable row level security;

drop policy if exists "Own accounts" on public.finance_accounts;
create policy "Own accounts"
  on public.finance_accounts for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.finance_investment_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.finance_accounts (id) on delete cascade,
  -- deposit: money put in · withdrawal: money taken out · value: current value on that date
  kind text not null check (kind in ('deposit', 'withdrawal', 'value')),
  amount numeric(14, 2) not null,
  note text check (length(note) <= 200),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  constraint finance_investment_entries_amount check (
    (kind = 'value' and amount >= 0) or (kind <> 'value' and amount > 0)
  )
);

create index if not exists finance_investment_entries_user_date
  on public.finance_investment_entries (user_id, occurred_on desc);

alter table public.finance_investment_entries enable row level security;

drop policy if exists "Own investment entries" on public.finance_investment_entries;
create policy "Own investment entries"
  on public.finance_investment_entries for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.finance_accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Budget lines: spend (category) or repay/collect (person)
-- ---------------------------------------------------------------------------
alter table public.finance_budget_lines
  alter column category_id drop not null;
alter table public.finance_budget_lines
  add column if not exists kind text not null default 'spend';
alter table public.finance_budget_lines
  add column if not exists person_id uuid references public.finance_people (id) on delete cascade;

-- Keeps lines in the order they were entered
alter table public.finance_budget_lines
  add column if not exists position integer not null default 0;

alter table public.finance_budget_lines
  drop constraint if exists finance_budget_lines_kind;
alter table public.finance_budget_lines
  add constraint finance_budget_lines_kind check (
    (kind = 'spend' and category_id is not null and person_id is null)
    or (kind in ('repay', 'collect') and person_id is not null and category_id is null)
  );

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
    and (
      category_id is null
      or exists (
        select 1 from public.finance_categories c
        where c.id = category_id and c.user_id = (select auth.uid())
      )
    )
    and (
      person_id is null
      or exists (
        select 1 from public.finance_people p
        where p.id = person_id and p.user_id = (select auth.uid())
      )
    )
  );

-- p_lines: [{ "kind": "spend"|"repay"|"collect", "category_id": uuid|null, "person_id": uuid|null, "amount": number, "note": text|null }]
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

  insert into public.finance_budget_lines (budget_id, position, kind, category_id, person_id, amount, note)
  select
    v_id,
    n,
    coalesce(nullif(l ->> 'kind', ''), 'spend'),
    nullif(l ->> 'category_id', '')::uuid,
    nullif(l ->> 'person_id', '')::uuid,
    (l ->> 'amount')::numeric,
    nullif(l ->> 'note', '')
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as t (l, n)
  order by n;

  return v_id;
end;
$$;

revoke all on function public.save_finance_budget(text, text, numeric, numeric, jsonb) from public, anon;
grant execute on function public.save_finance_budget(text, text, numeric, numeric, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Descriptions the agent reads
-- ---------------------------------------------------------------------------
comment on table public.finance_people is 'People the user borrows money from or lends money to.';
comment on table public.finance_debts is 'Borrow/lend ledger (not income or expense). amount is INR. Amount the user owes a person = borrowed - repaid; amount a person owes the user = lent - received.';
comment on column public.finance_debts.kind is 'borrowed = user took money, repaid = user returned it, lent = user gave money, received = person returned it';
comment on column public.finance_debts.person_id is 'References finance_people.id';
comment on table public.finance_accounts is 'Savings and investment accounts (FD, mutual fund, stocks, PPF, gold...).';
comment on column public.finance_accounts.kind is 'savings, fd, rd, mutual_fund, stocks, ppf, epf, nps, gold, crypto, real_estate or other';
comment on column public.finance_accounts.color is 'Chart color slot 1-8 (not meaningful for analysis)';
comment on table public.finance_investment_entries is 'Money put into or taken out of an account, and value snapshots. amount is INR. Invested = deposits - withdrawals. Current value = latest value entry plus deposits minus withdrawals dated after it (or invested if no value entry). Money saved in a period = deposits - withdrawals in that period.';
comment on column public.finance_investment_entries.kind is 'deposit, withdrawal, or value (the account''s total worth on occurred_on)';
comment on column public.finance_budget_lines.kind is 'spend = planned expense in category_id; repay = planned money to return to person_id; collect = planned money to get back from person_id';
comment on column public.finance_budget_lines.position is 'Display order within the plan';
comment on column public.finance_budget_lines.person_id is 'References finance_people.id for repay/collect lines';
comment on column public.finance_budget_lines.category_id is 'References finance_categories.id for spend lines';
comment on column public.finance_budgets.savings_target is 'Planned savings for the period in INR; compare with deposits - withdrawals in finance_investment_entries for that period';
