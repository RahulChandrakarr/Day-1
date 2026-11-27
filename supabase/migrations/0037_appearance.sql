-- Settings -> Appearance: the picture behind every page. Saved on the
-- profile, so it follows the person to every device. (Light/dark is kept on
-- each device instead, since it follows that device's own setting.)

alter table public.profiles
  add column if not exists background text not null default 'sky'
    check (background in ('sky', 'sand', 'blush', 'mist', 'dusk', 'upload')),
  add column if not exists background_path text;

comment on column public.profiles.background is
  'Page background: sky (the default photo), a built-in gradient, or upload (their own photo at background_path)';
comment on column public.profiles.background_path is
  'Their own background photo in the private "backgrounds" storage bucket, under <user id>/';

-- Profiles have no update policy (roles stay locked), so the background is
-- changed only through this function, for the signed-in person.
create or replace function public.set_my_background(p_background text, p_path text)
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
  if p_background not in ('sky', 'sand', 'blush', 'mist', 'dusk', 'upload') then
    raise exception 'Unknown background';
  end if;
  if p_background = 'upload' and (p_path is null or p_path not like uid::text || '/%') then
    raise exception 'Invalid photo path';
  end if;
  -- A built-in background keeps any uploaded photo, so it can be picked again
  update public.profiles
     set background = p_background,
         background_path = case when p_background = 'upload' then p_path else background_path end
   where id = uid;
end;
$$;

revoke all on function public.set_my_background(text, text) from public, anon;
grant execute on function public.set_my_background(text, text) to authenticated;

-- Their photos: private, under <user id>/, phone photos shrunk before upload
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backgrounds', 'backgrounds', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The same own-folder rules as documents and avatars, now covering backgrounds
drop policy if exists "Own files: read" on storage.objects;
create policy "Own files: read"
  on storage.objects for select
  to authenticated
  using (bucket_id in ('documents', 'avatars', 'backgrounds')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own files: upload" on storage.objects;
create policy "Own files: upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('documents', 'avatars', 'backgrounds')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own files: update" on storage.objects;
create policy "Own files: update"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('documents', 'avatars', 'backgrounds')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own files: delete" on storage.objects;
create policy "Own files: delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('documents', 'avatars', 'backgrounds')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
