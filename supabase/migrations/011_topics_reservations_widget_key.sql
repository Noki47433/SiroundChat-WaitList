-- Summary: Adds business topics, reservations, and hardens widget keys.

create extension if not exists pgcrypto;

-- Ensure widget_key is UUID, unique, and present for all businesses.
alter table businesses add column if not exists widget_key uuid;

update businesses
set widget_key = null
where widget_key is not null
  and (
    widget_key::text = ''
    or widget_key::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

alter table businesses
  alter column widget_key type uuid
  using nullif(widget_key::text, '')::uuid;

with ranked as (
  select id, widget_key, row_number() over (partition by widget_key order by created_at nulls last, id) as rn
  from businesses
  where widget_key is not null
)
update businesses b
set widget_key = gen_random_uuid()
from ranked r
where b.id = r.id and r.rn > 1;

update businesses set widget_key = gen_random_uuid() where widget_key is null;

alter table businesses alter column widget_key set default gen_random_uuid();
alter table businesses alter column widget_key set not null;

create unique index if not exists businesses_widget_key_unique
  on businesses(widget_key) where widget_key is not null;

-- Helper for RLS checks.
create or replace function is_business_owner(target_business_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from businesses b where b.id = target_business_id and b.owner_id = auth.uid()
  );
$$;

-- Business topics for per-industry keyword tracking.
create table if not exists business_topics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  topic text not null,
  keywords text[] not null default '{}'::text[],
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists business_topics_unique_idx on business_topics(business_id, topic);
create index if not exists business_topics_business_id_idx on business_topics(business_id, created_at desc);

create or replace function set_business_topics_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists business_topics_set_updated_at on business_topics;
create trigger business_topics_set_updated_at
before update on business_topics
for each row execute function set_business_topics_updated_at();

alter table business_topics enable row level security;
create policy if not exists "business_topics_select_owner" on business_topics
for select using (is_business_owner(business_id));
create policy if not exists "business_topics_insert_owner" on business_topics
for insert with check (is_business_owner(business_id));
create policy if not exists "business_topics_update_owner" on business_topics
for update using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create policy if not exists "business_topics_delete_owner" on business_topics
for delete using (is_business_owner(business_id));

-- Reservations created by the assistant/service only.
create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  customer_email text null,
  party_size int null,
  datetime timestamptz not null,
  notes text null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists reservations_business_created_idx on reservations(business_id, created_at desc);
create index if not exists reservations_business_status_idx on reservations(business_id, status);

alter table reservations enable row level security;
create policy if not exists "reservations_select_owner" on reservations
for select using (is_business_owner(business_id));
create policy if not exists "reservations_update_owner" on reservations
for update using (is_business_owner(business_id)) with check (is_business_owner(business_id));
