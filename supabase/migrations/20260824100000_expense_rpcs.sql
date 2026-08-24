-- Phase 1/2: expense writes, balances, and settlement.
--
-- Expense writes move behind security definer RPCs for the same reason group creation did
-- (RETURNING is checked against SELECT policies) and, more importantly, because an expense and
-- its shares must land together or not at all. The reconciliation invariant — shares sum exactly
-- to the total in minor units — is enforced here, server-side, not in the browser.

drop policy if exists expenses_insert_member on public.expenses;
drop policy if exists expenses_update_member on public.expenses;
drop policy if exists expense_payers_all_member on public.expense_payers;
drop policy if exists expense_shares_all_member on public.expense_shares;

create policy expense_payers_select_member on public.expense_payers
for select to authenticated
using (exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)));

create policy expense_shares_select_member on public.expense_shares
for select to authenticated
using (exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)));

-- p_payers: [{"user_id": uuid, "amount_minor": bigint}]
-- p_shares: [{"user_id": uuid, "share_amount_minor": bigint, "share_percent": numeric, "share_units": int}]
create function public.create_expense(
  p_group_id uuid,
  p_description text,
  p_total_amount_minor bigint,
  p_split_method text,
  p_payers jsonb,
  p_shares jsonb,
  p_category_id uuid default null,
  p_expense_date date default current_date,
  p_currency text default null,
  p_receipt_url text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense public.expenses;
  v_currency text;
  v_payer_total bigint;
  v_share_total bigint;
  v_bad_member uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'you are not a member of this group' using errcode = '42501';
  end if;

  if p_total_amount_minor is null or p_total_amount_minor <= 0 then
    raise exception 'amount must be greater than zero' using errcode = '22023';
  end if;

  if coalesce(trim(p_description), '') = '' then
    raise exception 'description is required' using errcode = '22023';
  end if;

  if p_split_method not in ('equal', 'exact', 'percent', 'shares') then
    raise exception 'unknown split method: %', p_split_method using errcode = '22023';
  end if;

  select coalesce(p_currency, g.default_currency) into v_currency
  from public.groups g where g.id = p_group_id;

  -- Everyone named must actually belong to the group.
  select payer.user_id into v_bad_member
  from jsonb_to_recordset(p_payers) as payer(user_id uuid, amount_minor bigint)
  where not exists (
    select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = payer.user_id
  )
  limit 1;
  if v_bad_member is not null then
    raise exception 'payer % is not in this group', v_bad_member using errcode = '22023';
  end if;

  select share.user_id into v_bad_member
  from jsonb_to_recordset(p_shares) as share(user_id uuid, share_amount_minor bigint)
  where not exists (
    select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = share.user_id
  )
  limit 1;
  if v_bad_member is not null then
    raise exception 'participant % is not in this group', v_bad_member using errcode = '22023';
  end if;

  -- The reconciliation gate: both sides of the ledger must equal the total, to the minor unit.
  select coalesce(sum(amount_minor), 0) into v_payer_total
  from jsonb_to_recordset(p_payers) as payer(amount_minor bigint);

  select coalesce(sum(share_amount_minor), 0) into v_share_total
  from jsonb_to_recordset(p_shares) as share(share_amount_minor bigint);

  if v_payer_total <> p_total_amount_minor then
    raise exception 'payer amounts sum to % but the expense total is %', v_payer_total, p_total_amount_minor
      using errcode = '22023';
  end if;

  if v_share_total <> p_total_amount_minor then
    raise exception 'shares sum to % but the expense total is %', v_share_total, p_total_amount_minor
      using errcode = '22023';
  end if;

  insert into public.expenses (
    group_id, description, category_id, total_amount_minor, currency,
    split_method, expense_date, receipt_url, created_by
  )
  values (
    p_group_id, trim(p_description), p_category_id, p_total_amount_minor, v_currency,
    p_split_method, coalesce(p_expense_date, current_date), p_receipt_url, v_user_id
  )
  returning * into v_expense;

  insert into public.expense_payers (expense_id, user_id, amount_minor)
  select v_expense.id, payer.user_id, payer.amount_minor
  from jsonb_to_recordset(p_payers) as payer(user_id uuid, amount_minor bigint)
  where payer.amount_minor > 0;

  insert into public.expense_shares (expense_id, user_id, share_amount_minor, share_percent, share_units)
  select v_expense.id, share.user_id, share.share_amount_minor, share.share_percent, share.share_units
  from jsonb_to_recordset(p_shares)
    as share(user_id uuid, share_amount_minor bigint, share_percent numeric, share_units int);

  return v_expense;
end;
$$;

create function public.update_expense(
  p_expense_id uuid,
  p_description text,
  p_total_amount_minor bigint,
  p_split_method text,
  p_payers jsonb,
  p_shares jsonb,
  p_category_id uuid default null,
  p_expense_date date default current_date,
  p_receipt_url text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_created_by uuid;
  v_created_at timestamptz;
  v_new public.expenses;
begin
  select group_id, created_by, created_at into v_group_id, v_created_by, v_created_at
  from public.expenses where id = p_expense_id;

  if v_group_id is null then
    raise exception 'expense not found' using errcode = 'P0002';
  end if;

  if not public.is_group_member(v_group_id) then
    raise exception 'you are not a member of this group' using errcode = '42501';
  end if;

  -- Rebuild rather than patch: the shares are only meaningful as a set that reconciles.
  delete from public.expenses where id = p_expense_id;

  v_new := public.create_expense(
    v_group_id, p_description, p_total_amount_minor, p_split_method,
    p_payers, p_shares, p_category_id, p_expense_date, null, p_receipt_url
  );

  return v_new;
end;
$$;

-- Net balance per member, in minor units.
--   positive => the group owes them (creditor)
--   negative => they owe the group (debtor)
-- A settlement you *paid* raises your balance toward zero; one you *received* lowers it.
create function public.group_balances(p_group_id uuid)
returns table (user_id uuid, net_minor bigint)
language sql
stable
security definer
set search_path = public
as $$
  with ledger as (
    select p.user_id, p.amount_minor as delta
    from public.expense_payers p
    join public.expenses e on e.id = p.expense_id
    where e.group_id = p_group_id

    union all

    select s.user_id, -s.share_amount_minor
    from public.expense_shares s
    join public.expenses e on e.id = s.expense_id
    where e.group_id = p_group_id

    union all

    select st.from_user, st.amount_minor
    from public.settlements st
    where st.group_id = p_group_id

    union all

    select st.to_user, -st.amount_minor
    from public.settlements st
    where st.group_id = p_group_id
  )
  select m.user_id, coalesce(sum(l.delta), 0)::bigint
  from public.group_members m
  left join ledger l on l.user_id = m.user_id
  where m.group_id = p_group_id
    and public.is_group_member(p_group_id)
  group by m.user_id;
$$;

-- Greedy min-cash-flow: repeatedly settle the largest creditor against the largest debtor.
-- Not provably the minimum number of transfers (that variant is NP-hard) but it is what
-- Splitwise does and it is optimal enough at real group sizes.
create function public.simplify_debts(p_group_id uuid)
returns table (from_user uuid, to_user uuid, amount_minor bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_bal bigint[];
  v_ci int;
  v_di int;
  v_amt bigint;
  i int;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'you are not a member of this group' using errcode = '42501';
  end if;

  select array_agg(b.user_id order by b.user_id), array_agg(b.net_minor order by b.user_id)
  into v_ids, v_bal
  from public.group_balances(p_group_id) b
  where b.net_minor <> 0;

  if v_ids is null then
    return;
  end if;

  loop
    v_ci := null;
    v_di := null;

    for i in 1 .. array_length(v_bal, 1) loop
      if v_ci is null or v_bal[i] > v_bal[v_ci] then v_ci := i; end if;
      if v_di is null or v_bal[i] < v_bal[v_di] then v_di := i; end if;
    end loop;

    exit when v_ci is null or v_di is null or v_bal[v_ci] <= 0 or v_bal[v_di] >= 0;

    v_amt := least(v_bal[v_ci], -v_bal[v_di]);

    from_user := v_ids[v_di];
    to_user := v_ids[v_ci];
    amount_minor := v_amt;
    return next;

    v_bal[v_ci] := v_bal[v_ci] - v_amt;
    v_bal[v_di] := v_bal[v_di] + v_amt;
  end loop;
end;
$$;

create function public.settle_up(
  p_group_id uuid,
  p_to_user uuid,
  p_amount_minor bigint,
  p_note text default null
)
returns public.settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_settlement public.settlements;
  v_currency text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'you are not a member of this group' using errcode = '42501';
  end if;

  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_to_user) then
    raise exception 'that person is not in this group' using errcode = '22023';
  end if;

  if p_to_user = v_user_id then
    raise exception 'you cannot settle up with yourself' using errcode = '22023';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'amount must be greater than zero' using errcode = '22023';
  end if;

  select default_currency into v_currency from public.groups where id = p_group_id;

  insert into public.settlements (group_id, from_user, to_user, amount_minor, currency, note, created_by)
  values (p_group_id, v_user_id, p_to_user, p_amount_minor, v_currency, p_note, v_user_id)
  returning * into v_settlement;

  return v_settlement;
end;
$$;

revoke execute on function public.create_expense(uuid, text, bigint, text, jsonb, jsonb, uuid, date, text, text) from anon;
revoke execute on function public.update_expense(uuid, text, bigint, text, jsonb, jsonb, uuid, date, text) from anon;
revoke execute on function public.group_balances(uuid) from anon;
revoke execute on function public.simplify_debts(uuid) from anon;
revoke execute on function public.settle_up(uuid, uuid, bigint, text) from anon;
