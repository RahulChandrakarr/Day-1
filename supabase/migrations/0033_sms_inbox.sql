-- Bank alerts forwarded from the phone, waiting to be confirmed.
--
-- India's Account Aggregator framework is closed to personal apps (an FIU has
-- to be regulated by RBI, SEBI, IRDAI or PFRDA), and bank developer APIs need a
-- company. What is available is the message the bank already sends for every
-- debit and credit: an automation app on the phone forwards those to this app,
-- the text is parsed, and the result waits here until it is accepted.
--
-- Nothing here is money yet. A row becomes a real entry only when the user
-- accepts it, and then transaction_id points at what was created.

alter table public.bank_accounts
  add column if not exists account_tail text
    check (account_tail is null or account_tail ~ '^[0-9]{3,6}$');

comment on column public.bank_accounts.account_tail is
  'Last few digits of the account number, used to match a forwarded bank message to this account';

-- The token the phone sends, so a forwarded message can be tied to its owner
-- without a login. Rotating it stops an old automation dead.
alter table public.profiles
  add column if not exists inbox_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_inbox_token on public.profiles (inbox_token);

comment on column public.profiles.inbox_token is
  'Secret in the forwarding URL; identifies whose inbox a forwarded message belongs to';

create table if not exists public.finance_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null default 'sms' check (source in ('sms', 'email')),
  sender text check (length(sender) <= 60),
  -- The message as received, kept so a bad parse can be read and fixed
  body text not null check (length(body) <= 1000),
  received_at timestamptz not null default now(),

  -- What the parser made of it; all null when it could not read the message
  direction text check (direction in ('debit', 'credit')),
  amount numeric(14, 2) check (amount > 0),
  account_tail text,
  merchant text check (length(merchant) <= 120),
  reference text check (length(reference) <= 60),
  occurred_on date,
  bank_account_id uuid references public.bank_accounts (id) on delete set null,

  status text not null default 'new' check (status in ('new', 'accepted', 'ignored')),
  transaction_id uuid references public.finance_transactions (id) on delete set null,
  -- The same payment often arrives twice; this keeps the second one out
  fingerprint text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists finance_inbox_fingerprint
  on public.finance_inbox (user_id, fingerprint);
create index if not exists finance_inbox_pending
  on public.finance_inbox (user_id, status, received_at desc);

alter table public.finance_inbox enable row level security;

drop policy if exists "Own inbox" on public.finance_inbox;
create policy "Own inbox"
  on public.finance_inbox for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.finance_inbox is
  'Bank messages forwarded from the phone, parsed and waiting to be confirmed. A row is not money: it becomes a finance_transactions row only when accepted, and transaction_id then points at it. status new means waiting, accepted means it was turned into an entry, ignored means dismissed.';
comment on column public.finance_inbox.body is 'The forwarded message, as received';
comment on column public.finance_inbox.direction is 'debit when money left the account, credit when it arrived';
comment on column public.finance_inbox.fingerprint is 'Identifies the same payment arriving twice, so it is only shown once';
