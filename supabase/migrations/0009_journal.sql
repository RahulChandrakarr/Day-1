-- Daily journal: one page per day, plus the user's habit list.
-- Every row belongs to one user and is only visible to that user.

-- ---------------------------------------------------------------------------
-- Habits (the checklist shown on every journal page)
-- ---------------------------------------------------------------------------
create table if not exists public.journal_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create unique index if not exists journal_habits_unique_name
  on public.journal_habits (user_id, lower(name));

alter table public.journal_habits enable row level security;

drop policy if exists "Own habits" on public.journal_habits;
create policy "Own habits"
  on public.journal_habits for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Journal pages
-- ---------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  gratitude text[] not null default '{}' check (cardinality(gratitude) <= 3),
  -- [{ "text": string, "done": boolean }], up to 3
  priorities jsonb not null default '[]' check (jsonb_typeof(priorities) = 'array' and jsonb_array_length(priorities) <= 3),
  habits_done uuid[] not null default '{}',
  notes text not null default '' check (length(notes) <= 20000),
  wins text not null default '' check (length(wins) <= 2000),
  lessons text not null default '' check (length(lessons) <= 2000),
  tomorrow text not null default '' check (length(tomorrow) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists journal_entries_unique_day
  on public.journal_entries (user_id, entry_date);

alter table public.journal_entries enable row level security;

drop policy if exists "Own journal" on public.journal_entries;
create policy "Own journal"
  on public.journal_entries for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Descriptions the agent reads
-- ---------------------------------------------------------------------------
comment on table public.journal_habits is 'Habits the user wants to track every day (e.g. workout, read).';
comment on table public.journal_entries is 'Daily journal, one row per day (entry_date, Asia/Kolkata calendar date). Personal writing: summarise gently.';
comment on column public.journal_entries.mood is '1 = very low ... 5 = great; null if not set';
comment on column public.journal_entries.energy is '1 = drained ... 5 = full of energy; null if not set';
comment on column public.journal_entries.gratitude is 'Up to 3 things the user was grateful for';
comment on column public.journal_entries.priorities is 'Up to 3 top priorities for the day: [{text, done}]';
comment on column public.journal_entries.habits_done is 'journal_habits.id values ticked off that day';
comment on column public.journal_entries.notes is 'Free-form notes about the day';
comment on column public.journal_entries.tomorrow is 'What to start with the next day';
