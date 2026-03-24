-- Summary: Adds capacity-based reservations, reservation settings, and visual lane display support.

create extension if not exists pgcrypto;

create table if not exists public.restaurants (
  id uuid primary key references public.businesses(id) on delete cascade,
  timezone text null,
  total_capacity int not null default 40,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurants add column if not exists timezone text;
alter table public.restaurants add column if not exists total_capacity int not null default 40;
alter table public.restaurants add column if not exists created_at timestamptz not null default now();
alter table public.restaurants add column if not exists updated_at timestamptz not null default now();

insert into public.restaurants (id, timezone, total_capacity)
select b.id, b.timezone, 40
from public.businesses b
on conflict (id) do update
set timezone = coalesce(public.restaurants.timezone, excluded.timezone);

create table if not exists public.restaurant_members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create index if not exists restaurant_members_user_id_idx on public.restaurant_members(user_id);

insert into public.restaurant_members (restaurant_id, user_id, role)
select b.id, b.owner_id, 'owner'
from public.businesses b
where b.owner_id is not null
on conflict (restaurant_id, user_id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurant_members_role_check'
      and conrelid = 'public.restaurant_members'::regclass
  ) then
    alter table public.restaurant_members
      add constraint restaurant_members_role_check
      check (role in ('owner', 'manager', 'staff'));
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.reservation_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  slot_interval_min int not null default 15,
  default_duration_min int not null default 90,
  lead_time_min int not null default 60,
  max_days_ahead int not null default 30,
  buffer_before_min int not null default 0,
  buffer_after_min int not null default 0,
  auto_archive_after_hours int not null default 72,
  lane_count int not null default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reservation_settings add column if not exists restaurant_id uuid;
alter table public.reservation_settings add column if not exists slot_interval_min int not null default 15;
alter table public.reservation_settings add column if not exists default_duration_min int not null default 90;
alter table public.reservation_settings add column if not exists lead_time_min int not null default 60;
alter table public.reservation_settings add column if not exists max_days_ahead int not null default 30;
alter table public.reservation_settings add column if not exists buffer_before_min int not null default 0;
alter table public.reservation_settings add column if not exists buffer_after_min int not null default 0;
alter table public.reservation_settings add column if not exists auto_archive_after_hours int not null default 72;
alter table public.reservation_settings add column if not exists lane_count int not null default 12;
alter table public.reservation_settings add column if not exists created_at timestamptz not null default now();
alter table public.reservation_settings add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_settings_restaurant_id_fkey'
      and conrelid = 'public.reservation_settings'::regclass
  ) then
    alter table public.reservation_settings
      add constraint reservation_settings_restaurant_id_fkey
      foreign key (restaurant_id) references public.restaurants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_settings_pkey'
      and conrelid = 'public.reservation_settings'::regclass
  ) then
    alter table public.reservation_settings
      add constraint reservation_settings_pkey primary key (restaurant_id);
  end if;
end $$;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  business_id uuid null references public.businesses(id) on delete cascade,
  conversation_id uuid null references public.chat_conversations(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  datetime timestamptz null,
  party_size int not null check (party_size > 0),
  customer_name text not null,
  customer_phone text null,
  customer_email text null,
  notes text null,
  status text not null check (status in ('pending', 'confirmed', 'seated', 'completed', 'canceled', 'no_show')),
  created_by text not null check (created_by in ('dashboard', 'chatbot', 'widget', 'phone')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canceled_at timestamptz null,
  canceled_by text null check (canceled_by in ('staff', 'customer')),
  cancel_reason text null,
  seated_at timestamptz null,
  completed_at timestamptz null,
  no_show_at timestamptz null
);

alter table public.reservations add column if not exists restaurant_id uuid;
alter table public.reservations add column if not exists business_id uuid;
alter table public.reservations add column if not exists conversation_id uuid;
alter table public.reservations add column if not exists start_at timestamptz;
alter table public.reservations add column if not exists end_at timestamptz;
alter table public.reservations add column if not exists datetime timestamptz;
alter table public.reservations add column if not exists updated_at timestamptz not null default now();
alter table public.reservations add column if not exists created_by text;
alter table public.reservations add column if not exists canceled_at timestamptz;
alter table public.reservations add column if not exists canceled_by text;
alter table public.reservations add column if not exists cancel_reason text;
alter table public.reservations add column if not exists seated_at timestamptz;
alter table public.reservations add column if not exists completed_at timestamptz;
alter table public.reservations add column if not exists no_show_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reservations'
      and column_name = 'business_id'
  ) then
    execute 'update public.reservations set restaurant_id = business_id where restaurant_id is null and business_id is not null';
  end if;
end $$;

update public.reservations
set restaurant_id = coalesce(restaurant_id, business_id)
where restaurant_id is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reservations'
      and column_name = 'datetime'
  ) then
    execute 'update public.reservations set start_at = coalesce(start_at, datetime, created_at, now()) where start_at is null';
  else
    execute 'update public.reservations set start_at = coalesce(start_at, created_at, now()) where start_at is null';
  end if;
end $$;

update public.reservations
set end_at = coalesce(end_at, start_at + interval '90 minutes')
where end_at is null;

update public.reservations
set datetime = start_at
where datetime is null;

update public.reservations
set party_size = 1
where party_size is null or party_size <= 0;

-- Drop legacy status checks before remapping values from cancelled -> canceled.
do $$
declare
  c record;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and contype = 'c'
  loop
    if c.def ilike '%status%' then
      execute format('alter table public.reservations drop constraint if exists %I', c.conname);
    end if;
  end loop;
end $$;

update public.reservations
set status = 'canceled'
where status = 'cancelled';

update public.reservations
set status = 'pending'
where status is null;

update public.reservations
set created_by = 'chatbot'
where created_by is null;

do $$
declare
  c record;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and contype = 'c'
  loop
    if c.def ilike '%status%'
      or c.def ilike '%party_size%'
      or c.def ilike '%created_by%'
      or c.def ilike '%canceled_by%'
    then
      execute format('alter table public.reservations drop constraint if exists %I', c.conname);
    end if;
  end loop;
end $$;

alter table public.reservations alter column customer_phone drop not null;
alter table public.reservations alter column party_size set not null;
alter table public.reservations alter column restaurant_id set not null;
alter table public.reservations alter column start_at set not null;
alter table public.reservations alter column end_at set not null;
alter table public.reservations alter column status set not null;
alter table public.reservations alter column status set default 'pending';
alter table public.reservations alter column created_by set not null;
alter table public.reservations alter column created_by set default 'chatbot';
alter table public.reservations alter column updated_at set default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reservations'
      and column_name = 'conversation_id'
  ) then
    alter table public.reservations alter column conversation_id drop not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_restaurant_id_fkey'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      add constraint reservations_restaurant_id_fkey
      foreign key (restaurant_id) references public.restaurants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_party_size_check'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      add constraint reservations_party_size_check
      check (party_size > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_status_check'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      add constraint reservations_status_check
      check (status in ('pending', 'confirmed', 'seated', 'completed', 'canceled', 'no_show'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_created_by_check'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      add constraint reservations_created_by_check
      check (created_by in ('dashboard', 'chatbot', 'widget', 'phone'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_canceled_by_check'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      add constraint reservations_canceled_by_check
      check (canceled_by is null or canceled_by in ('staff', 'customer'));
  end if;
end $$;

create index if not exists reservations_restaurant_start_idx
  on public.reservations(restaurant_id, start_at);

create index if not exists reservations_restaurant_status_start_idx
  on public.reservations(restaurant_id, status, start_at);

create table if not exists public.reservation_display (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  lane_index int not null check (lane_index >= 0),
  layout_version int not null default 1,
  computed_at timestamptz not null default now()
);

alter table public.reservation_display add column if not exists reservation_id uuid;
alter table public.reservation_display add column if not exists restaurant_id uuid;
alter table public.reservation_display add column if not exists lane_index int;
alter table public.reservation_display add column if not exists layout_version int not null default 1;
alter table public.reservation_display add column if not exists computed_at timestamptz not null default now();

create index if not exists reservation_display_restaurant_lane_idx
  on public.reservation_display(restaurant_id, lane_index);

create index if not exists reservation_settings_restaurant_idx
  on public.reservation_settings(restaurant_id);

create or replace function public.can_access_restaurant(target_restaurant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = target_restaurant_id
      and rm.user_id = auth.uid()
  );
$$;

drop trigger if exists reservation_settings_set_updated_at on public.reservation_settings;
create trigger reservation_settings_set_updated_at
before update on public.reservation_settings
for each row execute function public.set_updated_at();

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

alter table public.reservation_settings enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_display enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'reservation_settings'
  loop
    execute format('drop policy if exists %I on public.reservation_settings', p.policyname);
  end loop;

  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'reservations'
  loop
    execute format('drop policy if exists %I on public.reservations', p.policyname);
  end loop;

  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'reservation_display'
  loop
    execute format('drop policy if exists %I on public.reservation_display', p.policyname);
  end loop;
end $$;

create policy reservation_settings_select_access
on public.reservation_settings
for select
using (public.can_access_restaurant(restaurant_id));

create policy reservation_settings_insert_access
on public.reservation_settings
for insert
with check (public.can_access_restaurant(restaurant_id));

create policy reservation_settings_update_access
on public.reservation_settings
for update
using (public.can_access_restaurant(restaurant_id))
with check (public.can_access_restaurant(restaurant_id));

create policy reservations_select_access
on public.reservations
for select
using (public.can_access_restaurant(restaurant_id));

create policy reservations_insert_access
on public.reservations
for insert
with check (public.can_access_restaurant(restaurant_id));

create policy reservations_update_access
on public.reservations
for update
using (public.can_access_restaurant(restaurant_id))
with check (public.can_access_restaurant(restaurant_id));

create policy reservation_display_select_access
on public.reservation_display
for select
using (public.can_access_restaurant(restaurant_id));

create policy reservation_display_insert_access
on public.reservation_display
for insert
with check (public.can_access_restaurant(restaurant_id));

create policy reservation_display_update_access
on public.reservation_display
for update
using (public.can_access_restaurant(restaurant_id))
with check (public.can_access_restaurant(restaurant_id));
