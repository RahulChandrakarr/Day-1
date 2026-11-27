-- The workday on its own: the mood in the office and how the day there went.

alter table public.journal_entries
  add column if not exists office_mood smallint check (office_mood between 1 and 5),
  add column if not exists office_notes text not null default '';

comment on column public.journal_entries.office_mood is 'Mood in the office that day, 1-5';
comment on column public.journal_entries.office_notes is 'How the day at the office went';
