-- Priorities are no longer capped at 3 (up to 50 per day).

alter table public.journal_entries
  drop constraint if exists journal_entries_priorities_check;

alter table public.journal_entries
  add constraint journal_entries_priorities_check check (
    jsonb_typeof(priorities) = 'array' and jsonb_array_length(priorities) <= 50
  );

comment on column public.journal_entries.priorities is 'Priorities for the day, in order: [{text, done}]';
