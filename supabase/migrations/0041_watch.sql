-- Watch desk: YouTube (Data API + official embed) and Instagram
-- (professional account Graph API — your own posts only).

alter table private.integration_keys
  drop constraint if exists integration_keys_provider_check,
  drop constraint if exists integration_keys_secret_check;

alter table private.integration_keys
  add constraint integration_keys_provider_check
    check (provider in ('splitwise', 'freelancer', 'upwork', 'youtube', 'instagram')),
  add constraint integration_keys_secret_check
    check (length(secret) between 20 and 2000);

comment on table private.integration_keys is
  'API keys people pasted in Settings -> Integrations to link their own accounts. Server-only.';

alter table public.assistant_personas
  drop constraint if exists assistant_personas_sections_check;

alter table public.assistant_personas
  add constraint assistant_personas_sections_check
    check (
      sections <@ array[
        'daily', 'plan', 'health', 'finance', 'documents', 'reports',
        'settings', 'world', 'jobs', 'watch'
      ]::text[]
    );

create table if not exists public.media_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('youtube', 'instagram')),
  source_id text not null check (length(trim(source_id)) between 1 and 200),
  title text not null check (length(trim(title)) between 1 and 200),
  channel text check (length(trim(channel)) <= 120),
  url text not null check (length(url) between 8 and 500),
  thumb text check (length(thumb) <= 500),
  status text not null default 'saved' check (status in ('saved', 'watched')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, source_id)
);

create index if not exists media_saves_user_updated
  on public.media_saves (user_id, updated_at desc);

alter table public.media_saves enable row level security;

drop policy if exists "Own media saves" on public.media_saves;
create policy "Own media saves"
  on public.media_saves for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.media_saves is
  'YouTube videos and Instagram posts the person saved from Watch. Instagram media URLs expire, so we store the permalink.';
