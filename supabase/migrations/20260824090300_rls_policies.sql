-- profiles: you always see yourself, plus anyone you share a group with.

create policy profiles_select_self_or_groupmate on public.profiles
for select to authenticated
using (id = auth.uid() or public.shares_group_with(id));

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- groups: visible to members; anyone authenticated may create one (the trigger makes them owner).

create policy groups_select_member on public.groups
for select to authenticated
using (public.is_group_member(id));

create policy groups_insert_self on public.groups
for insert to authenticated
with check (created_by = auth.uid());

create policy groups_update_owner on public.groups
for update to authenticated
using (public.is_group_owner(id))
with check (public.is_group_owner(id));

create policy groups_delete_owner on public.groups
for delete to authenticated
using (public.is_group_owner(id));

-- group_members: members see the roster. Joining goes through join_group_with_invite(),
-- so there is deliberately no insert policy here.

create policy group_members_select_member on public.group_members
for select to authenticated
using (public.is_group_member(group_id));

create policy group_members_update_owner on public.group_members
for update to authenticated
using (public.is_group_owner(group_id))
with check (public.is_group_owner(group_id));

-- Leave a group yourself, or be removed by an owner.
create policy group_members_delete_self_or_owner on public.group_members
for delete to authenticated
using (user_id = auth.uid() or public.is_group_owner(group_id));

-- invites: only members of the group can see or mint them. Redeeming an invite you cannot
-- read is handled by the security definer RPCs.

create policy invites_select_member on public.invites
for select to authenticated
using (public.is_group_member(group_id));

create policy invites_insert_member on public.invites
for insert to authenticated
with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy invites_update_owner on public.invites
for update to authenticated
using (public.is_group_owner(group_id))
with check (public.is_group_owner(group_id));

create policy invites_delete_owner on public.invites
for delete to authenticated
using (public.is_group_owner(group_id));

-- categories: global defaults (group_id is null) are readable by everyone signed in;
-- custom ones belong to their group.

create policy categories_select on public.categories
for select to authenticated
using (group_id is null or public.is_group_member(group_id));

create policy categories_insert_member on public.categories
for insert to authenticated
with check (group_id is not null and public.is_group_member(group_id));

create policy categories_update_member on public.categories
for update to authenticated
using (group_id is not null and public.is_group_member(group_id))
with check (group_id is not null and public.is_group_member(group_id));

create policy categories_delete_member on public.categories
for delete to authenticated
using (group_id is not null and public.is_group_member(group_id));

-- expenses and their child rows: scoped to group membership.
-- Writes will move behind the create_expense RPC in phase 1; direct insert stays
-- member-scoped so the split reconciliation trigger remains the correctness gate.

create policy expenses_select_member on public.expenses
for select to authenticated
using (public.is_group_member(group_id));

create policy expenses_insert_member on public.expenses
for insert to authenticated
with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy expenses_update_member on public.expenses
for update to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

create policy expenses_delete_member on public.expenses
for delete to authenticated
using (public.is_group_member(group_id));

create policy expense_payers_all_member on public.expense_payers
for all to authenticated
using (exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)))
with check (exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)));

create policy expense_shares_all_member on public.expense_shares
for all to authenticated
using (exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)))
with check (exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)));

create policy settlements_select_member on public.settlements
for select to authenticated
using (public.is_group_member(group_id));

create policy settlements_insert_member on public.settlements
for insert to authenticated
with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy settlements_delete_member on public.settlements
for delete to authenticated
using (public.is_group_member(group_id));
