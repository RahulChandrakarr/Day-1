-- AI assistant: saved chats, daily briefings, and read-only data access for the agents.

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'New chat' check (length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_updated
  on public.ai_conversations (user_id, updated_at desc);

alter table public.ai_conversations enable row level security;

drop policy if exists "Own conversations" on public.ai_conversations;
create policy "Own conversations"
  on public.ai_conversations for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) <= 20000),
  -- Compacted tool results the answer was based on (assistant messages only)
  evidence jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_created
  on public.ai_messages (conversation_id, created_at);
create index if not exists ai_messages_user_created
  on public.ai_messages (user_id, created_at desc);

alter table public.ai_messages enable row level security;

drop policy if exists "Own messages" on public.ai_messages;
create policy "Own messages"
  on public.ai_messages for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

create or replace function private.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists ai_messages_touch on public.ai_messages;
create trigger ai_messages_touch
  after insert on public.ai_messages
  for each row execute function private.touch_conversation();

revoke execute on function private.touch_conversation() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Daily briefings
-- ---------------------------------------------------------------------------
create table if not exists public.ai_briefings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  for_date date not null,
  content text not null check (length(content) <= 20000),
  refresh_count smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, for_date)
);

alter table public.ai_briefings enable row level security;

drop policy if exists "Own briefings" on public.ai_briefings;
create policy "Own briefings"
  on public.ai_briefings for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Schema description for the data agent (only what the caller can read)
-- ---------------------------------------------------------------------------
create or replace function public.ai_schema()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'comment', obj_description(c.oid, 'pg_class'),
      'columns', (
        select jsonb_agg(jsonb_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'comment', col_description(c.oid, a.attnum)
        ) order by a.attnum)
        from pg_catalog.pg_attribute a
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      )
    ) order by c.relname), '[]'::jsonb)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  left join pg_catalog.pg_depend d on d.objid = c.oid and d.deptype = 'e'
  where n.nspname = 'public'
    and c.relkind in ('r', 'v', 'm')
    and d.objid is null -- skip objects owned by extensions
    and c.relname not like 'ai\_%'
    and has_table_privilege(c.oid, 'SELECT');
$$;

-- ---------------------------------------------------------------------------
-- Read-only SQL for the data agent.
-- Security layers:
--   1. SECURITY INVOKER → runs as the signed-in user, so RLS applies.
--   2. Must run inside a READ ONLY transaction (PostgREST GET request).
--   3. Single SELECT/WITH, keyword + schema denylist, row/size caps.
-- ---------------------------------------------------------------------------
create or replace function public.ai_readonly_query(q text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  body text := regexp_replace(btrim(coalesce(q, '')), ';\s*$', '');
  l text := lower(body);
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  if current_setting('transaction_read_only') <> 'on' then
    raise exception 'ai_readonly_query must be called in a read-only transaction';
  end if;
  if length(body) = 0 or length(body) > 4000 then
    raise exception 'query is empty or longer than 4000 characters';
  end if;
  if l !~ '^(select|with)\s' then
    raise exception 'only a single SELECT or WITH query is allowed';
  end if;
  if position(';' in body) > 0 or body ~ '(--|/\*)' then
    raise exception 'multiple statements and SQL comments are not allowed';
  end if;
  if l ~ '\m(insert|update|delete|merge|truncate|alter|create|drop|grant|revoke|copy|call|do|execute|prepare|listen|unlisten|notify|lock|vacuum|analyze|refresh|reindex|cluster|security|reset|load|discard|comment)\M' then
    raise exception 'forbidden keyword in query';
  end if;
  if l ~ '(set_config|current_setting|pg_sleep|pg_advisory|dblink|lo_\w+\s*\(|pg_read|pg_ls_|pg_stat|pg_terminate|pg_cancel|pg_reload|pg_notify|query_to_xml|table_to_xml|nextval|setval|txid_|pg_catalog|information_schema|\mauth\.|\mstorage\.|\mprivate\.|\mvault\.|\mextensions\.|\mrealtime\.|\msupabase_|\mgraphql|\mpg_roles|\mpg_authid|\mpg_shadow|\mai_(conversations|messages|briefings)\M)' then
    raise exception 'forbidden function, table or schema in query';
  end if;

  execute format(
    'select coalesce(jsonb_agg(r), ''[]''::jsonb) from (select * from (%s) as sub limit 200) r',
    body
  ) into result;

  if pg_column_size(result) > 200000 then
    raise exception 'result too large; aggregate in SQL or add filters';
  end if;
  return result;
end;
$$;

revoke all on function public.ai_readonly_query(text) from public, anon;
revoke all on function public.ai_schema() from public, anon;
grant execute on function public.ai_readonly_query(text) to authenticated;
grant execute on function public.ai_schema() to authenticated;

-- ---------------------------------------------------------------------------
-- Descriptions the agent reads (add these for every future table)
-- ---------------------------------------------------------------------------
comment on table public.profiles is 'People who can sign in. role is admin or user.';
comment on table public.finance_categories is 'User-defined categories for income and expense entries.';
comment on column public.finance_categories.type is 'income or expense';
comment on column public.finance_categories.color is 'Chart color slot 1-8 (not meaningful for analysis)';
comment on table public.finance_transactions is 'Income and expense entries. amount is INR and always positive; direction comes from type.';
comment on column public.finance_transactions.type is 'income or expense';
comment on column public.finance_transactions.period is 'daily = day-to-day entry, monthly = monthly bill/salary, yearly = yearly payment';
comment on column public.finance_transactions.occurred_on is 'Date the money moved (Asia/Kolkata calendar date)';
comment on column public.finance_transactions.category_id is 'References finance_categories.id; null means uncategorized';
