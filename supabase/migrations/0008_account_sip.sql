-- Recurring investments (SIP, RD): monthly amount and the day it's deducted.

alter table public.finance_accounts
  add column if not exists sip_day smallint check (sip_day between 1 and 31);
alter table public.finance_accounts
  add column if not exists sip_amount numeric(12, 2) check (sip_amount > 0);

comment on column public.finance_accounts.sip_day is 'Day of the month a SIP / recurring deposit is deducted (1-31); null if not recurring';
comment on column public.finance_accounts.sip_amount is 'Monthly SIP / recurring deposit amount in INR; null if not recurring';
