-- Every entry that moves real money can now say which bank account it moved
-- through, not just income and spending.
--
-- Before this, repaying a loan, lending someone money, paying an EMI or
-- putting money into a SIP left bank balances untouched, so the balance drifted
-- away from the real one. The day's net balance already counted borrow entries
-- marked in_balance, so the two figures disagreed.
--
-- A null bank_account_id means the money didn't move through a tracked account
-- (a share of a bill someone else paid, for instance), so it changes no balance.

alter table public.finance_debts
  add column if not exists bank_account_id uuid references public.bank_accounts (id) on delete set null;

alter table public.finance_emi_payments
  add column if not exists bank_account_id uuid references public.bank_accounts (id) on delete set null;

alter table public.finance_investment_entries
  add column if not exists bank_account_id uuid references public.bank_accounts (id) on delete set null;

create index if not exists finance_debts_bank on public.finance_debts (bank_account_id);
create index if not exists finance_emi_payments_bank on public.finance_emi_payments (bank_account_id);
create index if not exists finance_investment_entries_bank
  on public.finance_investment_entries (bank_account_id);

-- Balance = opening + income - spending + transfers in - transfers out
--           + money borrowed or returned to you - money you repaid or lent
--           - EMI payments
--           - money put into savings + money taken back out
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
      + coalesce((
          select sum(case when d.kind in ('borrowed', 'received') then d.amount else -d.amount end)
          from public.finance_debts d
          where d.bank_account_id = a.id and d.occurred_on <= p_as_of
        ), 0)
      - coalesce((
          select sum(p.amount) from public.finance_emi_payments p
          where p.bank_account_id = a.id and p.occurred_on <= p_as_of
        ), 0)
      + coalesce((
          select sum(case
                       when e.kind = 'deposit' then -e.amount
                       when e.kind = 'withdrawal' then e.amount
                       else 0
                     end)
          from public.finance_investment_entries e
          where e.bank_account_id = a.id and e.occurred_on <= p_as_of
        ), 0)
  from public.bank_accounts a
  order by a.created_at;
$$;

revoke all on function public.bank_balances(date) from public, anon;
grant execute on function public.bank_balances(date) to authenticated;

comment on table public.bank_accounts is
  'Bank accounts and cash the user spends from. Balance = opening_balance + linked income - linked expenses + transfers in - transfers out + money borrowed or returned to the user - money they repaid or lent - EMI payments - deposits into savings + withdrawals from savings. Only entries with a bank_account_id change a balance.';
comment on column public.finance_debts.bank_account_id is
  'Which account the money moved through: borrowed and received add to it, repaid and lent take from it. Null when no cash moved through a tracked account.';
comment on column public.finance_emi_payments.bank_account_id is
  'Which account the installment was paid from; null when not tracked';
comment on column public.finance_investment_entries.bank_account_id is
  'Which account the money came from (deposit) or went back into (withdrawal); null when not tracked. Value updates never move cash.';
