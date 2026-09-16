-- Assistant personas: the user's own assistant characters, and which persona a chat uses.

create table if not exists public.assistant_personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  emoji text not null default '✨' check (length(emoji) <= 8),
  instructions text not null default '' check (length(instructions) <= 4000),
  sections text[] not null default '{}' check (
    sections <@ array['daily', 'plan', 'health', 'finance', 'documents', 'reports', 'settings']::text[]
  ),
  language text not null default 'en-IN' check (language in ('en-IN', 'hi-IN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_personas_user on public.assistant_personas (user_id, created_at);

alter table public.assistant_personas enable row level security;

drop policy if exists "Own personas" on public.assistant_personas;
create policy "Own personas"
  on public.assistant_personas for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.assistant_personas is 'Custom assistant personas the user created (e.g. a Spanish tutor). Built-in personas live in code.';
comment on column public.assistant_personas.instructions is 'How the persona should behave, written by the user';
comment on column public.assistant_personas.sections is 'App areas the persona may read and change: daily, plan, health, finance, documents, reports, settings';
comment on column public.assistant_personas.language is 'Default voice language: en-IN or hi-IN';

-- Which persona a conversation uses: a built-in key or a custom persona id
alter table public.ai_conversations
  add column if not exists persona text not null default 'assistant'
  check (length(persona) <= 40);
