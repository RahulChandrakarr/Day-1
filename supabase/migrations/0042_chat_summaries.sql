-- Lasting notes from chats (kept forever) and a pin on the current topic.
-- Raw messages older than 30 days are deleted; these summaries stay.

alter table public.ai_conversations
  add column if not exists summary text check (summary is null or length(summary) <= 4000);

alter table public.ai_conversations
  add column if not exists last_sections text[] not null default '{}';

comment on column public.ai_conversations.summary is
  'Rolling summary of this chat, copied into ai_chat_summaries so it survives after messages are pruned.';
comment on column public.ai_conversations.last_sections is
  'App sections the last turn used, so a short follow-up (yes, a number) stays on the same topic.';

create table if not exists public.ai_chat_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete set null,
  title text not null default 'Chat' check (length(title) between 1 and 120),
  summary text not null check (length(trim(summary)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live summary per open chat; after the chat is deleted, conversation_id
-- is null and the row is kept as lasting knowledge about the user.
create unique index if not exists ai_chat_summaries_live_conversation
  on public.ai_chat_summaries (user_id, conversation_id)
  where conversation_id is not null;

create index if not exists ai_chat_summaries_user_updated
  on public.ai_chat_summaries (user_id, updated_at desc);

alter table public.ai_chat_summaries enable row level security;

drop policy if exists "Own chat summaries" on public.ai_chat_summaries;
create policy "Own chat summaries"
  on public.ai_chat_summaries for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.ai_chat_summaries is
  'What the user talked about with the assistant. Kept forever and used in later chats and the morning briefing. Raw ai_messages older than 30 days are removed.';
comment on column public.ai_chat_summaries.conversation_id is
  'The live chat this summary belongs to; null after that chat is deleted, so the note remains.';
