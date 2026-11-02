-- One row per day. Written on a schedule so the free Supabase project
-- keeps seeing activity and is less likely to pause after a quiet week.
-- The in-database job stops if the project is already paused, so the app's
-- daily cron and the GitHub schedule call record_heartbeat() from outside too.

create table if not exists public.db_heartbeats (
  day date primary key,
  hits integer not null default 0 check (hits >= 0),
  last_at timestamptz not null default now()
);

alter table public.db_heartbeats enable row level security;

revoke all on table public.db_heartbeats from anon, authenticated;

comment on table public.db_heartbeats is
  'Daily activity count. A scheduled job adds one hit so the database is not left idle.';

create or replace function public.record_heartbeat()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  insert into public.db_heartbeats (day, hits, last_at)
  values ((now() at time zone 'Asia/Kolkata')::date, 1, now())
  on conflict (day) do update
    set hits = public.db_heartbeats.hits + 1,
        last_at = excluded.last_at
  returning hits into total;
  return total;
end;
$$;

revoke all on function public.record_heartbeat() from public, anon, authenticated;
grant execute on function public.record_heartbeat() to anon, authenticated, service_role;

-- pg_cron runs inside Postgres. Scheduling is skipped, not fatal, when the
-- extension is not available on this database.
do $$
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception
    when others then
      raise notice 'pg_cron unavailable: %', sqlerrm;
      return;
  end;

  if exists (select 1 from cron.job where jobname = 'day-one-heartbeat') then
    perform cron.unschedule('day-one-heartbeat');
  end if;

  perform cron.schedule(
    'day-one-heartbeat',
    '30 2,8,14 * * *',
    'select public.record_heartbeat()'
  );
exception
  when others then
    raise notice 'heartbeat cron not scheduled: %', sqlerrm;
end;
$$;
