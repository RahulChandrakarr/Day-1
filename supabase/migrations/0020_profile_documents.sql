-- Profile photo, a private documents store, and a safe way to edit your own profile.

-- ---------------------------------------------------------------------------
-- Profile: name + photo, editable only through this function (role stays locked)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_path text;

create or replace function public.update_my_profile(p_full_name text, p_avatar_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  if p_avatar_path is not null and p_avatar_path not like uid::text || '/%' then
    raise exception 'Invalid photo path';
  end if;
  update public.profiles
     set full_name = nullif(left(trim(p_full_name), 80), ''),
         avatar_path = p_avatar_path
   where id = uid;
end;
$$;

revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  folder text not null default 'Other' check (length(trim(folder)) between 1 and 40),
  path text not null unique,
  mime text not null default '',
  size bigint not null default 0 check (size >= 0),
  created_at timestamptz not null default now()
);

create index if not exists documents_user_created on public.documents (user_id, created_at desc);

alter table public.documents enable row level security;

drop policy if exists "Own documents" on public.documents;
create policy "Own documents"
  on public.documents for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and path like (select auth.uid())::text || '/%');

comment on table public.documents is 'Files the user uploaded (IDs, bills, insurance, receipts). The file itself is in the private "documents" storage bucket at path.';

-- ---------------------------------------------------------------------------
-- Storage buckets (private), files kept under <user id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 10485760,
   array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('avatars', 'avatars', false, 3145728,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Own files: read" on storage.objects;
create policy "Own files: read"
  on storage.objects for select
  to authenticated
  using (bucket_id in ('documents', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own files: upload" on storage.objects;
create policy "Own files: upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('documents', 'avatars')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own files: update" on storage.objects;
create policy "Own files: update"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('documents', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own files: delete" on storage.objects;
create policy "Own files: delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('documents', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
