-- The trading journal: what was planned, what happened, and why.
--
-- One row per trade. While it is open, exit_price and exit_on are null. The
-- numbers the app works out from this (profit after charges, R multiple, win
-- rate, expectancy, which setups pay) are all arithmetic on these fields —
-- nothing here is a prediction or a recommendation.
--
-- stop_moves counts how often the stop was changed after entry, so "I keep
-- moving my stop" becomes something measured instead of something suspected.

create table if not exists public.finance_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol text not null check (length(trim(symbol)) between 1 and 40),
  kind text not null default 'swing' check (kind in ('intraday', 'swing', 'investment')),
  side text not null default 'long' check (side in ('long', 'short')),
  quantity numeric(18, 4) not null check (quantity > 0),
  entry_price numeric(14, 2) not null check (entry_price >= 0),
  entry_on date not null default current_date,
  stop_price numeric(14, 2) check (stop_price >= 0),
  target_price numeric(14, 2) check (target_price >= 0),
  -- A short name for the pattern traded: breakout, pullback, whatever he uses
  setup text check (length(trim(setup)) between 1 and 40),
  thesis text check (length(thesis) <= 1000),
  exit_price numeric(14, 2) check (exit_price >= 0),
  exit_on date,
  exit_reason text check (exit_reason in ('target', 'stop', 'manual', 'other')),
  review text check (length(review) <= 1000),
  -- Actual charges from the contract note, when known; otherwise estimated
  costs numeric(14, 2) check (costs >= 0),
  -- Path in the private "documents" storage bucket, under <user id>/trades/
  screenshot_path text check (length(screenshot_path) <= 300),
  stop_moves smallint not null default 0 check (stop_moves >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A closed trade has both a price and a date, or neither
  constraint finance_trades_exit_complete check (
    (exit_price is null and exit_on is null) or (exit_price is not null and exit_on is not null)
  ),
  constraint finance_trades_exit_after_entry check (exit_on is null or exit_on >= entry_on)
);

create index if not exists finance_trades_user_date
  on public.finance_trades (user_id, entry_on desc);

alter table public.finance_trades enable row level security;

drop policy if exists "Own trades" on public.finance_trades;
create policy "Own trades"
  on public.finance_trades for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.finance_trades is
  'Trading journal: one row per trade, open while exit_price is null. Amounts are INR. Profit = (exit_price - entry_price) * quantity for a long, reversed for a short, minus costs. Risk per share = entry_price - stop_price, and the R multiple is profit per share divided by that. Never advise on a trade from this table; report the record and the statistics.';
comment on column public.finance_trades.kind is 'intraday, swing or investment — the horizon it was taken for';
comment on column public.finance_trades.side is 'long (bought first) or short (sold first)';
comment on column public.finance_trades.setup is 'The pattern the user says they traded, their own words';
comment on column public.finance_trades.thesis is 'Why they took it, written at entry';
comment on column public.finance_trades.exit_reason is 'target, stop, manual or other — how the trade ended';
comment on column public.finance_trades.review is 'What they made of it afterwards';
comment on column public.finance_trades.costs is 'INR brokerage and taxes actually paid; null means the app estimates them';
comment on column public.finance_trades.stop_moves is 'How many times the stop was changed after entry';
