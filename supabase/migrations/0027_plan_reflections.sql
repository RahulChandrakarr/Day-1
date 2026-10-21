-- Five short answers to the daily plan questions on Overview.

create table if not exists public.plan_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null default current_date,
  answers text[] not null default '{}' check (cardinality(answers) <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists plan_reflections_user_day
  on public.plan_reflections (user_id, logged_on);

alter table public.plan_reflections enable row level security;

drop policy if exists "Own plan reflections" on public.plan_reflections;
create policy "Own plan reflections"
  on public.plan_reflections for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.plan_reflections is
  'Up to five short answers to the daily questions Overview asks about the running plan.';
