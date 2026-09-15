-- Borrow entries stay out of the daily net balance unless the user chose to count them.

alter table public.finance_debts
  add column if not exists in_balance boolean not null default false;

comment on column public.finance_debts.in_balance is 'true when the user chose to count this entry in their day''s net balance (cash in hand); false keeps it separate';
