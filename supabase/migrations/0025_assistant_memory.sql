-- The assistant's name (what the user calls her, also her wake word) and the
-- lasting facts she remembers about the user.

create table if not exists public.assistant_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Romi' check (length(trim(name)) between 1 and 20),
  updated_at timestamptz not null default now()
);

alter table public.assistant_settings enable row level security;

drop policy if exists "Own assistant settings" on public.assistant_settings;
create policy "Own assistant settings"
  on public.assistant_settings for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.assistant_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 60),
  value text not null check (length(trim(value)) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One fact per label: telling a new birthday replaces the old one
create unique index if not exists assistant_memories_label
  on public.assistant_memories (user_id, lower(label));

alter table public.assistant_memories enable row level security;

drop policy if exists "Own memories" on public.assistant_memories;
create policy "Own memories"
  on public.assistant_memories for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.assistant_settings is 'The assistant''s name for this user (default Romi); also the hands-free wake word';
comment on table public.assistant_memories is 'Lasting facts the user told the assistant about themselves (date of birth, family, job, preferences, allergies). label is the kind of fact, value the fact.';
