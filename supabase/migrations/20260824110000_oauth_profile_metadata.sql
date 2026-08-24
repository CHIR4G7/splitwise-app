-- Email signup puts the chosen name in raw_user_meta_data.display_name. Google returns
-- full_name / name / picture instead, so a Google user would otherwise land with a display
-- name derived from their email local-part and no avatar.

create function public.display_name_from(p_meta jsonb, p_email text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(p_meta ->> 'display_name'), ''),
    nullif(trim(p_meta ->> 'full_name'), ''),
    nullif(trim(p_meta ->> 'name'), ''),
    nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
    'Member'
  );
$$;

create function public.avatar_url_from(p_meta jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(p_meta ->> 'avatar_url'), ''),
    nullif(trim(p_meta ->> 'picture'), '')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    public.display_name_from(new.raw_user_meta_data, new.email),
    public.avatar_url_from(new.raw_user_meta_data)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- create_group upserts a profile for accounts that predate the trigger; keep it consistent.
create or replace function public.create_group(p_name text, p_icon text default '🧾', p_currency text default 'INR')
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

  insert into public.profiles (id, email, display_name, avatar_url)
  select u.id, u.email, public.display_name_from(u.raw_user_meta_data, u.email),
         public.avatar_url_from(u.raw_user_meta_data)
  from auth.users u
  where u.id = v_user_id
  on conflict (id) do nothing;

  insert into public.groups (name, icon, default_currency, created_by)
  values (trim(p_name), coalesce(nullif(p_icon, ''), '🧾'), upper(coalesce(nullif(p_currency, ''), 'INR')), v_user_id)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_user_id, 'owner')
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;

-- Backfill anyone who already signed up: fill a blank avatar, and replace an email-derived
-- display name when the provider gave us a real one.
update public.profiles p
set
  avatar_url = coalesce(p.avatar_url, public.avatar_url_from(u.raw_user_meta_data)),
  display_name = case
    when p.display_name = split_part(u.email, '@', 1)
      and public.display_name_from(u.raw_user_meta_data, u.email) <> split_part(u.email, '@', 1)
    then public.display_name_from(u.raw_user_meta_data, u.email)
    else p.display_name
  end
from auth.users u
where u.id = p.id;
