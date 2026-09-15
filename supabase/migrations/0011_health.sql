-- Health & Habits: weekly gym plan with daily check-offs, and habit check-ins.
-- Every row belongs to one user and is only visible to that user.

-- ---------------------------------------------------------------------------
-- Gym plan: one row per weekday (1 = Monday ... 7 = Sunday)
-- ---------------------------------------------------------------------------
create table if not exists public.gym_plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  title text not null default '' check (length(title) <= 40),
  rest boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists gym_plan_days_unique_weekday
  on public.gym_plan_days (user_id, weekday);

alter table public.gym_plan_days enable row level security;

drop policy if exists "Own gym plan days" on public.gym_plan_days;
create policy "Own gym plan days"
  on public.gym_plan_days for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.gym_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_id uuid not null references public.gym_plan_days (id) on delete cascade,
  position integer not null default 0,
  name text not null check (length(trim(name)) between 1 and 60),
  sets smallint check (sets between 1 and 50),
  reps smallint check (reps between 1 and 500),
  weight_kg numeric(6, 2) check (weight_kg >= 0),
  minutes smallint check (minutes between 1 and 600),
  note text check (length(note) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists gym_plan_exercises_day
  on public.gym_plan_exercises (day_id, position);

alter table public.gym_plan_exercises enable row level security;

drop policy if exists "Own gym exercises" on public.gym_plan_exercises;
create policy "Own gym exercises"
  on public.gym_plan_exercises for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.gym_plan_days d
      where d.id = day_id and d.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Gym tracker: an exercise ticked off on a date
-- ---------------------------------------------------------------------------
create table if not exists public.gym_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.gym_plan_exercises (id) on delete cascade,
  check_date date not null,
  created_at timestamptz not null default now()
);

create unique index if not exists gym_checkins_unique
  on public.gym_checkins (user_id, exercise_id, check_date);

alter table public.gym_checkins enable row level security;

drop policy if exists "Own gym checkins" on public.gym_checkins;
create policy "Own gym checkins"
  on public.gym_checkins for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.gym_plan_exercises e
      where e.id = exercise_id and e.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Habit check-ins (habits live in journal_habits)
-- ---------------------------------------------------------------------------
create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.journal_habits (id) on delete cascade,
  check_date date not null,
  done boolean not null,
  feeling text check (feeling in ('easy', 'okay', 'hard', 'proud')),
  reason text check (reason in ('stress', 'busy', 'craving', 'social', 'forgot', 'tired', 'other')),
  note text not null default '' check (length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists habit_checkins_unique
  on public.habit_checkins (user_id, habit_id, check_date);

alter table public.habit_checkins enable row level security;

drop policy if exists "Own habit checkins" on public.habit_checkins;
create policy "Own habit checkins"
  on public.habit_checkins for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.journal_habits h
      where h.id = habit_id and h.user_id = (select auth.uid())
    )
  );

-- Habits ticked in the journal so far become check-ins
insert into public.habit_checkins (user_id, habit_id, check_date, done)
select e.user_id, h.id, e.entry_date, true
from public.journal_entries e
cross join lateral unnest(e.habits_done) as done_id
join public.journal_habits h on h.id = done_id and h.user_id = e.user_id
on conflict (user_id, habit_id, check_date) do nothing;

-- ---------------------------------------------------------------------------
-- Descriptions the agent reads
-- ---------------------------------------------------------------------------
comment on table public.gym_plan_days is 'Weekly gym plan: weekday 1 = Monday ... 7 = Sunday, with a title (e.g. Chest day) or rest day.';
comment on table public.gym_plan_exercises is 'Planned exercises for a gym plan day: sets x reps, optional weight in kg, or minutes for cardio.';
comment on table public.gym_checkins is 'An exercise from the plan marked done on check_date.';
comment on table public.habit_checkins is 'Daily habit check-in: done or not, with how it felt (feeling) or why not (reason) and a note.';
comment on column public.habit_checkins.feeling is 'When done: easy, okay, hard or proud';
comment on column public.habit_checkins.reason is 'When not done: stress, busy, craving, social, forgot, tired or other';
comment on column public.journal_entries.habits_done is 'Deprecated: habit ticks now live in habit_checkins';
