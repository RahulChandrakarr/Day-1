-- Bank accounts (SBI, Axis, Cash...) with a running balance. Income and
-- expenses can say which account they came out of or went into, and
-- transfers move money between the user's own accounts.

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  -- Balance before any linked entry or transfer. Setting a new "current
  -- balance" adjusts this, so the history stays as logged.
  opening_balance numeric(14, 2) not null default 0,
  color smallint not null default 1 check (color between 1 and 8),
  created_at timestamptz not null default now()
);

create unique index if not exists bank_accounts_unique_name
  on public.bank_accounts (user_id, lower(name));

alter table public.bank_accounts enable row level security;

drop policy if exists "Own bank accounts" on public.bank_accounts;
create policy "Own bank accounts"
  on public.bank_accounts for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.finance_transactions
  add column if not exists bank_account_id uuid
    references public.bank_accounts (id) on delete set null;

create index if not exists finance_transactions_bank_account
  on public.finance_transactions (bank_account_id)
  where bank_account_id is not null;

-- A transaction may only point at the user's own category and bank account
drop policy if exists "Own transactions" on public.finance_transactions;
create policy "Own transactions"
  on public.finance_transactions for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      category_id is null
      or exists (
        select 1 from public.finance_categories c
        where c.id = category_id and c.user_id = (select auth.uid())
      )
    )
    and (
      bank_account_id is null
      or exists (
        select 1 from public.bank_accounts b
        where b.id = bank_account_id and b.user_id = (select auth.uid())
      )
    )
  );

create table if not exists public.bank_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_account_id uuid not null references public.bank_accounts (id) on delete cascade,
  to_account_id uuid not null references public.bank_accounts (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  note text check (length(note) <= 120),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

create index if not exists bank_transfers_user_date
  on public.bank_transfers (user_id, occurred_on desc);

alter table public.bank_transfers enable row level security;

drop policy if exists "Own bank transfers" on public.bank_transfers;
create policy "Own bank transfers"
  on public.bank_transfers for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.bank_accounts a
      where a.id = from_account_id and a.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.bank_accounts a
      where a.id = to_account_id and a.user_id = (select auth.uid())
    )
  );

-- Each account's balance at the end of a day. security invoker, so row
-- level security still limits it to the caller's accounts.
create or replace function public.bank_balances(p_as_of date)
returns table (
  id uuid,
  name text,
  color smallint,
  opening_balance numeric,
  balance numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    a.id,
    a.name,
    a.color,
    a.opening_balance,
    a.opening_balance
      + coalesce((
          select sum(case when t.type = 'income' then t.amount else -t.amount end)
          from public.finance_transactions t
          where t.bank_account_id = a.id and t.occurred_on <= p_as_of
        ), 0)
      + coalesce((
          select sum(x.amount) from public.bank_transfers x
          where x.to_account_id = a.id and x.occurred_on <= p_as_of
        ), 0)
      - coalesce((
          select sum(x.amount) from public.bank_transfers x
          where x.from_account_id = a.id and x.occurred_on <= p_as_of
        ), 0)
  from public.bank_accounts a
  order by a.created_at;
$$;

revoke all on function public.bank_balances(date) from public, anon;
grant execute on function public.bank_balances(date) to authenticated;

comment on table public.bank_accounts is 'Bank accounts and cash the user spends from. Balance = opening_balance + linked income - linked expenses + transfers in - transfers out.';
comment on column public.finance_transactions.bank_account_id is 'Which bank account the money came out of (expense) or went into (income); null when not tracked';
comment on table public.bank_transfers is 'Money moved between two of the user''s own bank accounts. Not income or spending.';
