-- Keys people paste to link their own accounts on outside services
-- (Settings -> Integrations). Splitwise is the first.
--
-- A key here opens the person's whole account on that service, so it lives in
-- the private schema: the browser's data API can't reach it, and no client
-- role has rights on it. Only server code reads it, over the direct database
-- connection, for the signed-in user. The browser only ever learns whether a
-- key is saved and whose account it opens.
create table if not exists private.integration_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('splitwise')),
  secret text not null check (length(secret) between 20 and 200),
  -- Who the key belongs to on that service, e.g. "Rahul Chandrakar"
  account_name text check (length(account_name) <= 120),
  account_id text check (length(account_id) <= 64),
  connected_at timestamptz not null default now(),
  primary key (user_id, provider)
);

revoke all on private.integration_keys from public, anon, authenticated;

comment on table private.integration_keys is
  'API keys people pasted in Settings -> Integrations to link their own accounts on outside services. Server-only.';
