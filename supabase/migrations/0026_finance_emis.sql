-- EMIs: a loan or installment the user is paying down.
-- Paid so far is the sum of finance_emi_payments; remaining = total − paid.

create table if not exists public.finance_emis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  lender text check (lender is null or length(trim(lender)) between 1 and 60),
  -- Full amount still to be repaid when tracking started, including interest.
  total_amount numeric(14, 2) not null check (total_amount > 0),
  monthly_amount numeric(12, 2) not null check (monthly_amount > 0),
  start_on date not null default current_date,
  due_day smallint not null check (due_day between 1 and 31),
  tenure_months integer check (tenure_months is null or tenure_months between 1 and 720),
  note text check (note is null or length(note) <= 200),
  color smallint not null default 1 check (color between 1 and 8),
  created_at timestamptz not null default now()
);

create unique index if not exists finance_emis_unique_name
  on public.finance_emis (user_id, lower(name));

create index if not exists finance_emis_user
  on public.finance_emis (user_id);

alter table public.finance_emis enable row level security;

drop policy if exists "Own emis" on public.finance_emis;
create policy "Own emis"
  on public.finance_emis for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.finance_emi_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emi_id uuid not null references public.finance_emis (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  note text check (note is null or length(note) <= 200),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists finance_emi_payments_user_date
  on public.finance_emi_payments (user_id, occurred_on desc);

create index if not exists finance_emi_payments_emi
  on public.finance_emi_payments (emi_id, occurred_on desc);

alter table public.finance_emi_payments enable row level security;

drop policy if exists "Own emi payments" on public.finance_emi_payments;
create policy "Own emi payments"
  on public.finance_emi_payments for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.finance_emis e
      where e.id = emi_id and e.user_id = (select auth.uid())
    )
  );

comment on table public.finance_emis is
  'Loans and installments the user is paying. amount fields are INR. Remaining = total_amount minus sum of finance_emi_payments.';
comment on column public.finance_emis.total_amount is
  'Total still to repay when tracking started (principal + interest), in INR.';
comment on column public.finance_emis.monthly_amount is
  'The EMI deducted each month, in INR.';
comment on column public.finance_emis.due_day is
  'Day of the month the EMI is due (1-31; clamped to the last day in short months).';
comment on column public.finance_emis.tenure_months is
  'Original tenure in months, if known; remaining months are derived from remaining / monthly.';
comment on table public.finance_emi_payments is
  'Each installment (or extra payment) against an EMI. Not income or expense unless also logged as a transaction.';
comment on column public.finance_emi_payments.amount is 'INR paid on occurred_on';
