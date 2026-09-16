-- Plans: yearly goals broken into monthly, weekly and daily items, with
-- optional number targets and progress logs. Plus free-form notes.
-- Every row belongs to one user and is only visible to that user.

create table if not exists public.plan_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year smallint not null check (year between 2000 and 2200),
  title text not null check (length(trim(title)) between 1 and 80),
  emoji text not null default '🎯' check (length(emoji) <= 8),
  notes text not null default '' check (length(notes) <= 20000),
  -- Optional number to reach, e.g. 200000 (₹), 24 (books), 10 (kg)
  target_value numeric(14, 2) check (target_value > 0),
  unit text check (length(unit) <= 16),
  position integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plan_goals_user_year on public.plan_goals (user_id, year);

alter table public.plan_goals enable row level security;

drop policy if exists "Own plan goals" on public.plan_goals;
create policy "Own plan goals"
  on public.plan_goals for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- One row per month target, week target or day task.
-- period: YYYY-MM for months, YYYY-MM-wN (N = 1..4) for weeks, YYYY-MM-DD for days
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.plan_goals (id) on delete cascade,
  level text not null check (level in ('month', 'week', 'day')),
  period text not null,
  title text not null default '' check (length(title) <= 200),
  notes text not null default '' check (length(notes) <= 4000),
  target_value numeric(14, 2) check (target_value >= 0),
  done boolean not null default false,
  done_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_items_period_format check (
    (level = 'month' and period ~ '^\d{4}-(0[1-9]|1[0-2])$')
    or (level = 'week' and period ~ '^\d{4}-(0[1-9]|1[0-2])-w[1-4]$')
    or (level = 'day' and period ~ '^\d{4}-\d{2}-\d{2}$')
  )
);

create index if not exists plan_items_goal on public.plan_items (goal_id, level, period);
create index if not exists plan_items_user_period on public.plan_items (user_id, level, period);

alter table public.plan_items enable row level security;

drop policy if exists "Own plan items" on public.plan_items;
create policy "Own plan items"
  on public.plan_items for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.plan_goals g
      where g.id = goal_id and g.user_id = (select auth.uid())
    )
  );

-- Progress toward a goal's number, e.g. "saved 5000 on 16 Sep"
create table if not exists public.plan_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.plan_goals (id) on delete cascade,
  logged_on date not null default current_date,
  amount numeric(14, 2) not null check (amount <> 0),
  note text not null default '' check (length(note) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists plan_progress_goal on public.plan_progress (goal_id, logged_on);

alter table public.plan_progress enable row level security;

drop policy if exists "Own plan progress" on public.plan_progress;
create policy "Own plan progress"
  on public.plan_progress for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.plan_goals g
      where g.id = goal_id and g.user_id = (select auth.uid())
    )
  );

-- Notes
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (length(title) <= 120),
  body text not null default '' check (length(body) <= 50000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated on public.notes (user_id, updated_at desc);

alter table public.notes enable row level security;

drop policy if exists "Own notes" on public.notes;
create policy "Own notes"
  on public.notes for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Morning push with today's plan tasks
alter table public.reminder_settings
  drop constraint if exists reminder_settings_kind_check;
alter table public.reminder_settings
  add constraint reminder_settings_kind_check check (
    kind in ('briefing', 'journal', 'habits', 'gym', 'money', 'spend_pin', 'plan')
  );

comment on table public.plan_goals is 'Yearly goals with notes and an optional number to reach (target_value in unit).';
comment on table public.plan_items is 'Breakdown of a goal: level month (period YYYY-MM), week (YYYY-MM-w1..w4, weeks are days 1-7, 8-14, 15-21, 22-end) or day task (YYYY-MM-DD). target_value is the share of the goal number for that period; done marks it complete.';
comment on table public.plan_progress is 'Amounts logged toward a goal number on a date.';
comment on table public.notes is 'Free-form notes with a title and body; pinned notes show first.';
