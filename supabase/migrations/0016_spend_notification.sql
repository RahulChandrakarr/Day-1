-- A pinned "today's spending" notification, refreshed when money is logged.

alter table public.reminder_settings
  drop constraint if exists reminder_settings_kind_check;

alter table public.reminder_settings
  add constraint reminder_settings_kind_check check (
    kind in ('briefing', 'journal', 'habits', 'gym', 'money', 'spend_pin')
  );

comment on column public.reminder_settings.kind is 'briefing = AI morning summary; journal/habits/gym/money = nudges; spend_pin = keep today spending in the notification shade';
