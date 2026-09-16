-- Goals run between a start and end month of their year.

alter table public.plan_goals
  add column if not exists start_month smallint not null default 1
    check (start_month between 1 and 12);
alter table public.plan_goals
  add column if not exists end_month smallint not null default 12
    check (end_month between 1 and 12);

alter table public.plan_goals
  drop constraint if exists plan_goals_month_order;
alter table public.plan_goals
  add constraint plan_goals_month_order check (start_month <= end_month);

comment on column public.plan_goals.start_month is 'First month (1-12) the goal is active in its year';
comment on column public.plan_goals.end_month is 'Last month (1-12) the goal is active; splits and progress use this range';
