-- Job desk: openings saved from public boards and official APIs
-- (Jobs in the Me menu). Apply on most boards is a link out; Freelancer
-- bids go through their API when a token is saved in integration_keys.

alter table private.integration_keys
  drop constraint if exists integration_keys_provider_check,
  drop constraint if exists integration_keys_secret_check;

alter table private.integration_keys
  add constraint integration_keys_provider_check
    check (provider in ('splitwise', 'freelancer', 'upwork')),
  add constraint integration_keys_secret_check
    check (length(secret) between 20 and 500);

comment on table private.integration_keys is
  'API keys people pasted in Settings -> Integrations to link their own accounts. Server-only.';

-- Custom personas may now include world (web/songs) and jobs.
alter table public.assistant_personas
  drop constraint if exists assistant_personas_sections_check;

alter table public.assistant_personas
  add constraint assistant_personas_sections_check
    check (
      sections <@ array[
        'daily', 'plan', 'health', 'finance', 'documents', 'reports',
        'settings', 'world', 'jobs'
      ]::text[]
    );

comment on column public.assistant_personas.sections is
  'App areas the persona may read and change.';

create table if not exists public.job_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (
    source in (
      'remoteok', 'remotive', 'arbeitnow', 'jobicy', 'himalayas',
      'freelancer', 'adzuna', 'upwork'
    )
  ),
  source_id text not null check (length(trim(source_id)) between 1 and 200),
  title text not null check (length(trim(title)) between 1 and 200),
  company text check (length(trim(company)) <= 120),
  url text not null check (length(url) between 8 and 500),
  location text check (length(trim(location)) <= 160),
  pay text check (length(trim(pay)) <= 80),
  summary text check (length(summary) <= 800),
  status text not null default 'saved' check (
    status in ('saved', 'applied', 'interview', 'won', 'passed')
  ),
  notes text not null default '' check (length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, source_id)
);

create index if not exists job_saves_user_updated
  on public.job_saves (user_id, updated_at desc);

alter table public.job_saves enable row level security;

drop policy if exists "Own job saves" on public.job_saves;
create policy "Own job saves"
  on public.job_saves for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.job_saves is
  'Openings the person saved or applied to from the Jobs desk. Listings themselves are fetched live from public APIs and are not stored here until saved.';
comment on column public.job_saves.source is
  'Which board the opening came from';
comment on column public.job_saves.status is
  'saved = bookmarked; applied = sent (via Freelancer bid or by opening the board); interview / won / passed are hand-set';
