-- Everything the Overview page needs, in one call instead of a dozen.
-- security invoker, so row level security still limits it to the caller.

create or replace function public.overview_snapshot(
  p_today date,
  p_month_start date,
  p_weekday smallint
)
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  select jsonb_build_object(
    -- Money: this month up to today, with today's rows carrying their category
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'type', t.type, 'amount', t.amount,
        'description', t.description, 'period', t.period,
        'occurred_on', t.occurred_on, 'created_at', t.created_at,
        'category', case when c.id is null then null else
          jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color) end)
        order by t.occurred_on desc, t.created_at desc)
      from public.finance_transactions t
      left join public.finance_categories c on c.id = t.category_id
      where t.occurred_on between p_month_start and p_today
    ), '[]'::jsonb),

    -- Borrow: what the user owes and is owed, netted per person
    'balances', (
      select jsonb_build_object(
        'owe', coalesce(sum(greatest(net, 0)), 0),
        'owed', coalesce(sum(greatest(-net, 0)), 0))
      from (
        select sum(case d.kind
                     when 'borrowed' then d.amount
                     when 'repaid' then -d.amount
                     when 'lent' then -d.amount
                     else d.amount end) as net
        from public.finance_debts d
        group by d.person_id
      ) per_person
    ),

    -- Savings: latest valuation plus anything moved after it, else money put in
    'savings_worth', coalesce((
      select sum(case when v.amount is null then coalesce(put_in.net, 0)
                      else v.amount + coalesce(after.net, 0) end)
      from public.finance_accounts a
      left join lateral (
        select sum(case e.kind when 'deposit' then e.amount
                               when 'withdrawal' then -e.amount else 0 end) as net
        from public.finance_investment_entries e where e.account_id = a.id
      ) put_in on true
      left join lateral (
        select e.amount, e.occurred_on, e.created_at
        from public.finance_investment_entries e
        where e.account_id = a.id and e.kind = 'value'
        order by e.occurred_on desc, e.created_at desc limit 1
      ) v on true
      left join lateral (
        select sum(case e.kind when 'deposit' then e.amount
                               when 'withdrawal' then -e.amount else 0 end) as net
        from public.finance_investment_entries e
        where e.account_id = a.id and e.kind <> 'value'
          and (e.occurred_on > v.occurred_on
               or (e.occurred_on = v.occurred_on and e.created_at > v.created_at))
      ) after on true
    ), 0),

    'debts_today', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'kind', d.kind, 'amount', d.amount, 'note', d.note,
        'occurred_on', d.occurred_on, 'created_at', d.created_at,
        'in_balance', d.in_balance,
        'person', jsonb_build_object('id', p.id, 'name', p.name)))
      from public.finance_debts d
      join public.finance_people p on p.id = d.person_id
      where d.occurred_on = p_today
    ), '[]'::jsonb),

    'investments_today', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'account_id', e.account_id, 'kind', e.kind,
        'amount', e.amount, 'note', e.note, 'occurred_on', e.occurred_on,
        'created_at', e.created_at,
        'account_name', a.name, 'color', a.color))
      from public.finance_investment_entries e
      join public.finance_accounts a on a.id = e.account_id
      where e.occurred_on = p_today and e.kind <> 'value'
    ), '[]'::jsonb),

    'saved_this_month', coalesce((
      select sum(case e.kind when 'deposit' then e.amount
                             when 'withdrawal' then -e.amount else 0 end)
      from public.finance_investment_entries e
      where e.occurred_on between p_month_start and p_today
    ), 0),

    -- Journal and mood
    'journal_today', exists (
      select 1 from public.journal_entries j where j.entry_date = p_today),
    'moods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entry_date', j.entry_date, 'mood', j.mood, 'energy', j.energy))
      from public.journal_entries j
      where j.entry_date between p_today - 6 and p_today
    ), '[]'::jsonb),

    'body_logs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'logged_on', b.logged_on, 'weight_kg', b.weight_kg,
        'waist_cm', b.waist_cm, 'neck_cm', b.neck_cm, 'hip_cm', b.hip_cm)
        order by b.logged_on)
      from public.body_logs b
      where b.logged_on between p_month_start and p_today
    ), '[]'::jsonb),

    -- Today's workout from the running block (or the hand-made plan)
    'block', (
      select jsonb_build_object('id', b.id, 'name', b.name,
        'start_date', b.start_date, 'weeks', b.weeks, 'number', b.number)
      from public.gym_blocks b
      where b.start_date <= p_today
        and b.start_date + (b.weeks * 7 - 1) >= p_today
      order by b.start_date desc limit 1
    ),
    'plan_day', (
      select jsonb_build_object(
        'weekday', d.weekday, 'title', d.title, 'rest', d.rest,
        'exercises', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id, 'name', e.name, 'sets', e.sets, 'reps', e.reps,
            'weight_kg', e.weight_kg, 'minutes', e.minutes, 'note', e.note,
            'muscle', e.muscle, 'rest_seconds', e.rest_seconds, 'rir', e.rir)
            order by e.position)
          from public.gym_plan_exercises e where e.day_id = d.id), '[]'::jsonb))
      from public.gym_plan_days d
      where d.weekday = p_weekday
        and d.block_id is not distinct from (
          select b.id from public.gym_blocks b
          where b.start_date <= p_today
            and b.start_date + (b.weeks * 7 - 1) >= p_today
          order by b.start_date desc limit 1)
      limit 1
    ),
    'gym_checkins', coalesce((
      select jsonb_object_agg(day, ids)
      from (
        select c.check_date::text as day, jsonb_agg(c.exercise_id) as ids
        from public.gym_checkins c
        where c.check_date between p_today - 30 and p_today
        group by c.check_date
      ) by_day
    ), '{}'::jsonb),

    -- Habits and their recent check-ins, for streaks and averages
    'habits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id, 'name', h.name, 'kind', h.kind,
        'count_label', h.count_label, 'daily_limit', h.daily_limit)
        order by h.created_at)
      from public.journal_habits h
    ), '[]'::jsonb),
    'habit_checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'habit_id', c.habit_id, 'check_date', c.check_date, 'done', c.done,
        'count', c.count, 'feeling', c.feeling, 'reason', c.reason, 'note', c.note))
      from public.habit_checkins c
      where c.check_date between p_today - 60 and p_today
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.overview_snapshot(date, date, smallint) from public, anon;
grant execute on function public.overview_snapshot(date, date, smallint) to authenticated;

comment on function public.overview_snapshot(date, date, smallint) is 'Everything the Overview page shows, in one call: money this month, borrow balances, savings worth, today workout and check-ins, habits, journal and mood, body logs.';
