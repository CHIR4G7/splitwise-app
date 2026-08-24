-- SplitEase core schema.
-- All monetary values are integers in the currency's minor unit (paise/cents). Never floats.

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  default_currency char(3) not null default 'INR',
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  icon text not null default '🧾',
  default_currency char(3) not null default 'INR',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

create table public.invites (
  token text primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_group_idx on public.invites (group_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  icon text not null default '🏷️',
  created_at timestamptz not null default now()
);

-- group_id null marks a global default category available to every group.
create unique index categories_global_name_idx on public.categories (lower(name)) where group_id is null;
create unique index categories_group_name_idx on public.categories (group_id, lower(name)) where group_id is not null;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 140),
  category_id uuid references public.categories (id) on delete set null,
  total_amount_minor bigint not null check (total_amount_minor > 0),
  currency char(3) not null,
  split_method text not null default 'equal' check (split_method in ('equal', 'exact', 'percent', 'shares')),
  expense_date date not null default current_date,
  receipt_url text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index expenses_group_date_idx on public.expenses (group_id, expense_date desc);

create table public.expense_payers (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  primary key (expense_id, user_id)
);

create table public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  share_amount_minor bigint not null check (share_amount_minor >= 0),
  share_percent numeric(7, 4),
  share_units integer,
  primary key (expense_id, user_id)
);

create index expense_shares_user_idx on public.expense_shares (user_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete restrict,
  to_user uuid not null references public.profiles (id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  note text,
  settled_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  check (from_user <> to_user)
);

create index settlements_group_idx on public.settlements (group_id, settled_at desc);

-- Mirror every new auth user into profiles so the rest of the schema can foreign-key to it.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Group creator is always the first member, as owner.
create function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_group_created
after insert on public.groups
for each row execute function public.handle_new_group();

insert into public.categories (group_id, name, icon) values
  (null, 'Groceries', '🛒'),
  (null, 'Travel', '✈️'),
  (null, 'Rent', '🏠'),
  (null, 'Utilities', '💡'),
  (null, 'Sports', '🏅'),
  (null, 'Entertainment', '🎬'),
  (null, 'Dining', '🍽️'),
  (null, 'Other', '🧾');
