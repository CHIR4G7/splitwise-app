-- Invite redemption runs server-side: the joiner cannot read the group or the invite row yet,
-- and use counts must not be exceeded by concurrent redemptions.

create function public.preview_invite(p_token text)
returns table (group_id uuid, group_name text, group_icon text, member_count bigint, already_member boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.name,
    g.icon,
    (select count(*) from public.group_members m where m.group_id = g.id),
    exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid())
  from public.invites i
  join public.groups g on g.id = i.group_id
  where i.token = p_token
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses is null or i.uses < i.max_uses);
$$;

create function public.join_group_with_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Lock the invite row so parallel redemptions cannot both pass the max_uses check.
  select * into v_invite
  from public.invites
  where token = p_token
  for update;

  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'invite revoked' using errcode = 'P0001';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'invite expired' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.group_members
    where group_id = v_invite.group_id and user_id = auth.uid()
  ) then
    return v_invite.group_id;
  end if;

  if v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses then
    raise exception 'invite already fully used' using errcode = 'P0001';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_invite.group_id, auth.uid(), 'member');

  update public.invites set uses = uses + 1 where token = p_token;

  return v_invite.group_id;
end;
$$;

revoke execute on function public.preview_invite(text) from anon;
revoke execute on function public.join_group_with_invite(text) from anon;
