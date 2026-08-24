-- Creating a group through PostgREST as `insert ... returning` cannot work: Postgres applies
-- SELECT policies to RETURNING rows, and groups_select_member depends on a group_members row
-- that the AFTER INSERT trigger has not written yet. The insert succeeds and the read back is
-- refused (42501 -> HTTP 403).
--
-- Do it in one security definer call instead, so group + owner membership land together and
-- created_by is taken from the session rather than the client.

create function public.create_group(p_name text, p_icon text default '🧾', p_currency text default 'INR')
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_group public.groups;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'group name is required' using errcode = '22023';
  end if;

  -- The account may predate the handle_new_user trigger; make sure it has a profile to own the group.
  insert into public.profiles (id, email, display_name)
  select u.id, u.email, coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1))
  from auth.users u
  where u.id = v_user_id
  on conflict (id) do nothing;

  insert into public.groups (name, icon, default_currency, created_by)
  values (trim(p_name), coalesce(nullif(p_icon, ''), '🧾'), upper(coalesce(nullif(p_currency, ''), 'INR')), v_user_id)
  returning * into v_group;

  -- handle_new_group already added the owner row; this is a belt-and-braces no-op if it ran.
  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_user_id, 'owner')
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;

revoke execute on function public.create_group(text, text, text) from anon;
