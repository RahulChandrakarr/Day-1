-- Personal finance: categories and income/expense transactions.
-- Every row belongs to one user and is only visible to that user.

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  type text not null check (type in ('income', 'expense')),
  -- Index into the fixed 8-slot chart palette
  color smallint not null default 1 check (color between 1 and 8),
  created_at timestamptz not null default now()
);

create unique index if not exists finance_categories_unique_name
  on public.finance_categories (user_id, type, lower(name));

alter table public.finance_categories enable row level security;

drop policy if exists "Own categories" on public.finance_categories;
create policy "Own categories"
  on public.finance_categories for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  description text check (length(description) <= 200),
  category_id uuid references public.finance_categories (id) on delete set null,
  -- daily = day-to-day entry, monthly = monthly bill/salary, yearly = yearly payment
  period text not null default 'daily' check (period in ('daily', 'monthly', 'yearly')),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists finance_transactions_user_date
  on public.finance_transactions (user_id, occurred_on desc);

alter table public.finance_transactions enable row level security;

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
  );

-- ---------------------------------------------------------------------------
-- Starter categories for every user
-- ---------------------------------------------------------------------------
create or replace function private.seed_finance_categories(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.finance_categories (user_id, name, type, color)
  values
    (p_user_id, 'Food', 'expense', 1),
    (p_user_id, 'Transport', 'expense', 2),
    (p_user_id, 'Bills', 'expense', 3),
    (p_user_id, 'Shopping', 'expense', 4),
    (p_user_id, 'Health', 'expense', 5),
    (p_user_id, 'Entertainment', 'expense', 6),
    (p_user_id, 'Education', 'expense', 7),
    (p_user_id, 'Other', 'expense', 8),
    (p_user_id, 'Salary', 'income', 1),
    (p_user_id, 'Freelance', 'income', 2),
    (p_user_id, 'Gifts', 'income', 3),
    (p_user_id, 'Other', 'income', 8)
  on conflict do nothing;
$$;

create or replace function private.handle_new_profile_finance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_finance_categories(new.id);
  return new;
end;
$$;

drop trigger if exists on_profile_created_finance on public.profiles;
create trigger on_profile_created_finance
  after insert on public.profiles
  for each row execute function private.handle_new_profile_finance();

revoke execute on function private.seed_finance_categories(uuid) from public, anon, authenticated;
revoke execute on function private.handle_new_profile_finance() from public, anon, authenticated;

-- Backfill existing users
select private.seed_finance_categories(id) from public.profiles;
