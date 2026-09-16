-- Phone notifications: saved push subscriptions and the times to send at.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Own push subscriptions" on public.push_subscriptions;
create policy "Own push subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- One row per reminder kind per user
create table if not exists public.reminder_settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('briefing', 'journal', 'habits', 'gym', 'money')),
  enabled boolean not null default true,
  -- Local time in Asia/Kolkata
  hour smallint not null check (hour between 0 and 23),
  minute smallint not null default 0 check (minute between 0 and 59),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.reminder_settings enable row level security;

drop policy if exists "Own reminder settings" on public.reminder_settings;
create policy "Own reminder settings"
  on public.reminder_settings for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Keeps a reminder from being sent twice in a day
create table if not exists public.reminder_sends (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  sent_on date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, sent_on)
);

alter table public.reminder_sends enable row level security;

drop policy if exists "Own reminder sends" on public.reminder_sends;
create policy "Own reminder sends"
  on public.reminder_sends for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.push_subscriptions is 'Web push endpoints for a user''s phones and browsers.';
comment on table public.reminder_settings is 'When to send each reminder, in Asia/Kolkata time. briefing = the AI morning briefing.';
comment on table public.reminder_sends is 'Which reminders already went out on a date, so they are not repeated.';
