-- set_my_background now saves the photo path it's given for every choice, so
-- "Remove photo" can forget it (null), while switching to a built-in
-- background keeps the photo for later by passing the same path back.
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
  if p_path is not null and p_path not like uid::text || '/%' then
    raise exception 'Invalid photo path';
  end if;
  if p_background = 'upload' and p_path is null then
    raise exception 'Upload a photo first';
  end if;
  update public.profiles
     set background = p_background,
         background_path = p_path
   where id = uid;
end;
$$;

revoke all on function public.set_my_background(text, text) from public, anon;
grant execute on function public.set_my_background(text, text) to authenticated;
