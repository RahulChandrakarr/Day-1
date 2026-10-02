-- bank_balances also returns the account's last digits, so the edit form can
-- show what a forwarded message will be matched against. The return type
-- changes, so the function is dropped and recreated rather than replaced.

drop function if exists public.bank_balances(date);

create function public.bank_balances(p_as_of date)
returns table (
  id uuid,
  name text,
  color smallint,
  account_tail text,
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
    a.account_tail,
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
