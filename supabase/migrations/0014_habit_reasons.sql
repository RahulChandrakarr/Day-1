-- Reasons now depend on the habit: quitting something has different causes
-- than failing to do something.

alter table public.habit_checkins
  drop constraint if exists habit_checkins_reason_check;

alter table public.habit_checkins
  add constraint habit_checkins_reason_check check (
    reason in (
      'stress', 'busy', 'craving', 'social', 'forgot', 'tired', 'other',
      'boredom', 'autopilot', 'no_energy', 'unwell', 'travel'
    )
  );

comment on column public.habit_checkins.reason is 'Why it did not happen. Quit habits: craving, stress, social, boredom, autopilot. Build habits: busy, tired, forgot, no_energy, unwell, travel. Plus other.';
