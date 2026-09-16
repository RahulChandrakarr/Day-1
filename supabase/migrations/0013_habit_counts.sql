-- Habits can track a number per day (e.g. cigarettes), not just done/not done.

alter table public.journal_habits
  add column if not exists kind text not null default 'build'
    check (kind in ('build', 'quit'));
alter table public.journal_habits
  add column if not exists count_label text check (length(count_label) <= 20);
alter table public.journal_habits
  add column if not exists daily_limit smallint check (daily_limit between 0 and 1000);

alter table public.habit_checkins
  add column if not exists count smallint check (count between 0 and 1000);

comment on column public.journal_habits.kind is 'build = a habit to do, quit = something to cut down or stop';
comment on column public.journal_habits.count_label is 'What the daily number counts, e.g. cigarettes, glasses, minutes; null means no number is tracked';
comment on column public.journal_habits.daily_limit is 'Target for the daily number: a maximum for quit habits, a minimum for build habits';
comment on column public.habit_checkins.count is 'How many that day, when the habit tracks a number';
