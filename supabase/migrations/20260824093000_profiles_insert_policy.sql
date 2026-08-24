-- The handle_new_user trigger covers accounts created after it existed. Anyone who signed up
-- before that has an auth user with no profiles row, and no way to create one. Let a signed-in
-- user insert their own profile so the client can self-heal that gap.

create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (id = auth.uid());
