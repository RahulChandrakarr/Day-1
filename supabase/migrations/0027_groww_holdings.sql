-- Stock holdings synced from the Groww broker API.
-- These rows are a mirror of the demat account, not hand-entered: a sync
-- replaces them wholesale. Worth now = quantity * last_price; what was put in
-- = quantity * average_price; the difference is the gain.
-- Mutual funds are not in Groww's API, so those stay as finance_accounts rows.

create table if not exists public.finance_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  isin text not null check (length(trim(isin)) between 4 and 20),
  symbol text not null check (length(trim(symbol)) between 1 and 40),
  name text check (length(trim(name)) <= 120),
  exchange text not null default 'NSE' check (exchange in ('NSE', 'BSE')),
  quantity numeric(18, 4) not null check (quantity >= 0),
  average_price numeric(14, 2) not null check (average_price >= 0),
  last_price numeric(14, 2) check (last_price >= 0),
  day_change_perc numeric(8, 2),
  priced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_holdings_unique_symbol
  on public.finance_holdings (user_id, symbol);

alter table public.finance_holdings enable row level security;

drop policy if exists "Own holdings" on public.finance_holdings;
create policy "Own holdings"
  on public.finance_holdings for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- When the portfolio was last fetched, and why it failed if it did. No
-- credentials here: the Groww key and TOTP secret live in server env vars.
create table if not exists public.finance_portfolio_sync (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  synced_at timestamptz,
  status text not null default 'ok' check (status in ('ok', 'failed')),
  message text check (length(message) <= 300),
  holdings smallint not null default 0 check (holdings >= 0),
  updated_at timestamptz not null default now()
);

alter table public.finance_portfolio_sync enable row level security;

drop policy if exists "Own portfolio sync" on public.finance_portfolio_sync;
create policy "Own portfolio sync"
  on public.finance_portfolio_sync for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.finance_holdings is
  'Stocks held in the Groww demat account, refreshed from their API. Amounts are INR. Worth now = quantity * last_price; put in = quantity * average_price; gain is the difference. A sync replaces every row, so never hand-edit these; mutual funds and FDs are finance_accounts instead.';
comment on column public.finance_holdings.isin is 'Security identifier from the exchange, stable across symbol renames';
comment on column public.finance_holdings.symbol is 'Trading symbol, e.g. RELIANCE';
comment on column public.finance_holdings.exchange is 'Exchange the last price came from: NSE or BSE';
comment on column public.finance_holdings.quantity is 'Shares held, including shares pledged or locked';
comment on column public.finance_holdings.average_price is 'INR average buy price per share, as Groww reports it';
comment on column public.finance_holdings.last_price is 'INR last traded price per share, null until a price is fetched';
comment on column public.finance_holdings.day_change_perc is 'Percent the price moved today, null when unknown';
comment on column public.finance_holdings.priced_at is 'When last_price was fetched';

comment on table public.finance_portfolio_sync is
  'One row per user: when the Groww portfolio was last synced, how many holdings came back, and the error message if the last attempt failed. Quote synced_at when telling the user what their stocks are worth, because prices go stale.';
