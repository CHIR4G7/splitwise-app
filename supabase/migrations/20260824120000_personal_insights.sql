-- Phase 3: cross-group personal spend for a custom date range.
--
-- Returns one payload rather than four round trips, because the insights screen needs all the
-- breakdowns at once. Everything is keyed by currency: groups each carry their own, and summing
-- minor units across currencies would produce a confident, meaningless number.

create function public.personal_insights(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with my_shares as (
    select
      e.id as expense_id,
      e.group_id,
      e.currency,
      e.expense_date,
      e.category_id,
      e.description,
      s.share_amount_minor
    from public.expense_shares s
    join public.expenses e on e.id = s.expense_id
    where s.user_id = auth.uid()
      and e.expense_date between p_from and p_to
      and exists (
        select 1 from public.group_members m
        where m.group_id = e.group_id and m.user_id = auth.uid()
      )
  ),
  my_paid as (
    select e.currency, sum(p.amount_minor)::bigint as paid_minor
    from public.expense_payers p
    join public.expenses e on e.id = p.expense_id
    where p.user_id = auth.uid()
      and e.expense_date between p_from and p_to
      and exists (
        select 1 from public.group_members m
        where m.group_id = e.group_id and m.user_id = auth.uid()
      )
    group by e.currency
  ),
  currencies as (
    select currency from my_shares
    union
    select currency from my_paid
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,

    'totals', coalesce((
      select jsonb_agg(t order by t.share_minor desc)
      from (
        select
          c.currency,
          coalesce((select sum(s.share_amount_minor) from my_shares s where s.currency = c.currency), 0)::bigint as share_minor,
          coalesce((select p.paid_minor from my_paid p where p.currency = c.currency), 0)::bigint as paid_minor,
          coalesce((select count(*) from my_shares s where s.currency = c.currency), 0)::int as expense_count
        from currencies c
      ) t
    ), '[]'::jsonb),

    'by_category', coalesce((
      select jsonb_agg(t order by t.share_minor desc)
      from (
        select
          s.currency,
          s.category_id,
          coalesce(cat.name, 'Uncategorised') as name,
          coalesce(cat.icon, '🧾') as icon,
          sum(s.share_amount_minor)::bigint as share_minor,
          count(*)::int as expense_count
        from my_shares s
        left join public.categories cat on cat.id = s.category_id
        group by s.currency, s.category_id, cat.name, cat.icon
      ) t
    ), '[]'::jsonb),

    'by_group', coalesce((
      select jsonb_agg(t order by t.share_minor desc)
      from (
        select
          s.currency,
          s.group_id,
          g.name,
          g.icon,
          sum(s.share_amount_minor)::bigint as share_minor,
          count(*)::int as expense_count
        from my_shares s
        join public.groups g on g.id = s.group_id
        group by s.currency, s.group_id, g.name, g.icon
      ) t
    ), '[]'::jsonb),

    'by_month', coalesce((
      select jsonb_agg(t order by t.month)
      from (
        select
          s.currency,
          date_trunc('month', s.expense_date)::date as month,
          sum(s.share_amount_minor)::bigint as share_minor
        from my_shares s
        group by s.currency, date_trunc('month', s.expense_date)
      ) t
    ), '[]'::jsonb),

    'expenses', coalesce((
      select jsonb_agg(t order by t.expense_date desc, t.description)
      from (
        select
          s.expense_id,
          s.description,
          s.expense_date,
          s.currency,
          s.share_amount_minor,
          g.name as group_name,
          g.icon as group_icon,
          coalesce(cat.name, 'Uncategorised') as category_name,
          coalesce(cat.icon, '🧾') as category_icon
        from my_shares s
        join public.groups g on g.id = s.group_id
        left join public.categories cat on cat.id = s.category_id
        order by s.expense_date desc
        limit 200
      ) t
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.personal_insights(date, date) from anon;
