-- Carries emi_id through when a plan is saved, so an EMI line survives a save.
-- Without this the line is written with a null emi_id and the kind check rejects it.
-- p_lines: [{ "kind": "spend"|"repay"|"collect"|"emi", "category_id": uuid|null,
--             "person_id": uuid|null, "emi_id": uuid|null, "amount": number, "note": text|null }]
create or replace function public.save_finance_budget(
  p_scope text,
  p_period_key text,
  p_expected_income numeric,
  p_savings_target numeric,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.finance_budgets (scope, period_key, expected_income, savings_target)
  values (p_scope, p_period_key, p_expected_income, p_savings_target)
  on conflict (user_id, scope, period_key) do update
    set expected_income = excluded.expected_income,
        savings_target = excluded.savings_target,
        updated_at = now()
  returning id into v_id;

  delete from public.finance_budget_lines where budget_id = v_id;

  insert into public.finance_budget_lines
    (budget_id, position, kind, category_id, person_id, emi_id, amount, note)
  select
    v_id,
    n,
    coalesce(nullif(l ->> 'kind', ''), 'spend'),
    nullif(l ->> 'category_id', '')::uuid,
    nullif(l ->> 'person_id', '')::uuid,
    nullif(l ->> 'emi_id', '')::uuid,
    (l ->> 'amount')::numeric,
    nullif(l ->> 'note', '')
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as t (l, n)
  order by n;

  return v_id;
end;
$$;

revoke all on function public.save_finance_budget(text, text, numeric, numeric, jsonb) from public, anon;
grant execute on function public.save_finance_budget(text, text, numeric, numeric, jsonb) to authenticated;
