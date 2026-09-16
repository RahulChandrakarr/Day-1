-- Body profile and measurements, plus month-long training blocks with weekly progression.

-- ---------------------------------------------------------------------------
-- Body profile (one row per user) and measurement log
-- ---------------------------------------------------------------------------
create table if not exists public.body_profile (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sex text not null default 'male' check (sex in ('male', 'female')),
  age smallint check (age between 12 and 100),
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  activity text not null default 'moderate' check (
    activity in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),
  goal text not null default 'build' check (goal in ('lose', 'maintain', 'build', 'strength')),
  experience text not null default 'beginner' check (
    experience in ('beginner', 'intermediate', 'advanced')
  ),
  days_per_week smallint not null default 4 check (days_per_week between 2 and 6),
  equipment text not null default 'full_gym' check (
    equipment in ('full_gym', 'dumbbells', 'bodyweight')
  ),
  session_minutes smallint not null default 60 check (session_minutes between 20 and 150),
  updated_at timestamptz not null default now()
);

alter table public.body_profile enable row level security;

drop policy if exists "Own body profile" on public.body_profile;
create policy "Own body profile"
  on public.body_profile for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null default current_date,
  weight_kg numeric(5, 1) not null check (weight_kg between 25 and 400),
  waist_cm numeric(5, 1) check (waist_cm between 40 and 250),
  neck_cm numeric(5, 1) check (neck_cm between 20 and 80),
  hip_cm numeric(5, 1) check (hip_cm between 50 and 250),
  created_at timestamptz not null default now()
);

create unique index if not exists body_logs_unique_day
  on public.body_logs (user_id, logged_on);

alter table public.body_logs enable row level security;

drop policy if exists "Own body logs" on public.body_logs;
create policy "Own body logs"
  on public.body_logs for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Training blocks: a month of training, weeks 1-3 build, week 4 lighter
-- ---------------------------------------------------------------------------
create table if not exists public.gym_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '' check (length(name) <= 60),
  start_date date not null default current_date,
  weeks smallint not null default 4 check (weeks between 1 and 12),
  split text not null default 'custom' check (
    split in ('full_body', 'upper_lower', 'ppl', 'bro', 'custom')
  ),
  goal text not null default 'build',
  level text not null default 'beginner',
  days_per_week smallint not null default 4,
  number smallint not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists gym_blocks_user_start
  on public.gym_blocks (user_id, start_date desc);

alter table public.gym_blocks enable row level security;

drop policy if exists "Own gym blocks" on public.gym_blocks;
create policy "Own gym blocks"
  on public.gym_blocks for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Plan days now belong to a block (null = the older hand-made weekly plan)
alter table public.gym_plan_days
  add column if not exists block_id uuid references public.gym_blocks (id) on delete cascade;

drop index if exists public.gym_plan_days_unique_weekday;
create unique index if not exists gym_plan_days_unique_manual
  on public.gym_plan_days (user_id, weekday) where block_id is null;
create unique index if not exists gym_plan_days_unique_block
  on public.gym_plan_days (block_id, weekday) where block_id is not null;

-- Coaching details on each exercise
alter table public.gym_plan_exercises
  add column if not exists muscle text check (length(muscle) <= 30);
alter table public.gym_plan_exercises
  add column if not exists rest_seconds smallint check (rest_seconds between 15 and 600);
alter table public.gym_plan_exercises
  add column if not exists rir smallint check (rir between 0 and 5);

-- ---------------------------------------------------------------------------
-- Descriptions the agent reads
-- ---------------------------------------------------------------------------
comment on table public.body_profile is 'Training profile: sex, age, height, activity level, goal, experience, days per week, equipment and session length.';
comment on table public.body_logs is 'Body measurements over time. weight_kg, plus waist/neck/hip in cm for the body fat estimate.';
comment on table public.gym_blocks is 'A training block (usually 4 weeks): weeks 1-3 get harder, the last week is a lighter deload. number counts blocks for the user.';
comment on column public.gym_blocks.split is 'full_body, upper_lower, ppl (push/pull/legs), bro (one muscle a day) or custom';
comment on column public.gym_plan_days.block_id is 'The block this day belongs to; null for a hand-made weekly plan';
comment on column public.gym_plan_exercises.rir is 'Reps in reserve to leave on each set (2 = stop 2 reps before failure)';
comment on column public.gym_plan_exercises.rest_seconds is 'Rest between sets, in seconds';
