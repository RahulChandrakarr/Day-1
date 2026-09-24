-- How each stock is being held, and when it was bought.
--
-- Groww's API only returns today's orders, so purchase dates can't be fetched:
-- the user enters them once per holding, and finance_holding_lots records
-- anything bought later (the sync notices the quantity go up).
--
-- Why the dates matter: Indian listed equity sold within 12 months is taxed at
-- 20% (short term), and after 12 months at 12.5% on gains above ₹1.25 lakh in
-- the financial year. So a few more days of holding can be worth real money.

alter table public.finance_holdings
  add column if not exists mode text not null default 'long_term'
    check (mode in ('long_term', 'swing')),
  add column if not exists bought_on date,
  add column if not exists target_price numeric(14, 2) check (target_price > 0),
  add column if not exists stop_price numeric(14, 2) check (stop_price > 0);

create table if not exists public.finance_holding_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol text not null check (length(trim(symbol)) between 1 and 40),
  quantity numeric(18, 4) not null check (quantity > 0),
  price numeric(14, 2) not null check (price >= 0),
  bought_on date not null,
  -- True when the sync guessed the price from that day's close rather than
  -- being told what was paid
  estimated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists finance_holding_lots_user_symbol
  on public.finance_holding_lots (user_id, symbol, bought_on);

alter table public.finance_holding_lots enable row level security;

drop policy if exists "Own holding lots" on public.finance_holding_lots;
create policy "Own holding lots"
  on public.finance_holding_lots for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on column public.finance_holdings.mode is
  'How this one is held: long_term (years, tax clock matters) or swing (a trade with a target and a stop)';
comment on column public.finance_holdings.bought_on is
  'When the position was opened, entered by the user. Null means unknown, so no tax timing is shown.';
comment on column public.finance_holdings.target_price is 'INR price the user plans to sell at, their own number';
comment on column public.finance_holdings.stop_price is 'INR price the user plans to cut the loss at, their own number';

comment on table public.finance_holding_lots is
  'Each purchase of a stock, so tax timing can be worked out per lot. Amounts are INR. Sold shares are not tracked here: this is only what went in.';
