-- Summary: Adds deterministic sales/CRM/automation/channel tables with tenant-safe RLS for chatbot extensions.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

alter table public.businesses
  add column if not exists google_review_url text;

create or replace function public.can_manage_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_business_owner(target_business_id)
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text,
  phone text,
  email text,
  external_ids jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}'::text[],
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  source_channel text
);

create index if not exists customers_business_email_idx on public.customers(business_id, email);
create index if not exists customers_business_phone_idx on public.customers(business_id, phone);
create index if not exists customers_business_last_seen_idx on public.customers(business_id, last_seen_at desc);
create index if not exists customers_external_ids_gin_idx on public.customers using gin (external_ids);
create unique index if not exists customers_business_email_lower_unique
  on public.customers (business_id, lower(email))
  where email is not null;
create unique index if not exists customers_business_phone_unique
  on public.customers (business_id, phone)
  where phone is not null and btrim(phone) <> '';

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at
before update on public.customers
for each row execute function public.touch_updated_at();

create table if not exists public.customer_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customer_events_business_customer_created_idx
  on public.customer_events (business_id, customer_id, created_at desc);
create index if not exists customer_events_payload_gin_idx
  on public.customer_events using gin (payload);

create table if not exists public.lead_qualifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid references public.chat_conversations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  budget_range text,
  urgency text,
  decision_maker boolean,
  notes text,
  score int not null default 0 check (score between 0 and 100),
  status text not null default 'warm' check (status in ('hot', 'warm', 'cold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_qualifications_business_status_idx
  on public.lead_qualifications (business_id, status);
create index if not exists lead_qualifications_business_score_idx
  on public.lead_qualifications (business_id, score desc);

drop trigger if exists lead_qualifications_touch_updated_at on public.lead_qualifications;
create trigger lead_qualifications_touch_updated_at
before update on public.lead_qualifications
for each row execute function public.touch_updated_at();

create table if not exists public.qualification_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  questions jsonb not null default '[
    {"field":"budget_range","question":"What budget range are you planning for this project?"},
    {"field":"urgency","question":"How soon do you need this done (today, this week, or later)?"},
    {"field":"decision_maker","question":"Are you the decision-maker for this purchase?"}
  ]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists qualification_settings_touch_updated_at on public.qualification_settings;
create trigger qualification_settings_touch_updated_at
before update on public.qualification_settings
for each row execute function public.touch_updated_at();

create table if not exists public.upsell_catalog (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in ('reservation_size', 'time', 'intent', 'menu_item', 'custom')),
  trigger_rules jsonb not null default '{}'::jsonb,
  offer_payload jsonb not null default '{}'::jsonb,
  priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists upsell_catalog_business_active_idx
  on public.upsell_catalog (business_id, is_active);

drop trigger if exists upsell_catalog_touch_updated_at on public.upsell_catalog;
create trigger upsell_catalog_touch_updated_at
before update on public.upsell_catalog
for each row execute function public.touch_updated_at();

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  conversation_id uuid references public.chat_conversations(id) on delete set null,
  channel text not null default 'web_chat',
  offer_type text not null check (offer_type in ('upsell', 'comeback', 'limited', 'birthday', 'abandoned_recovery')),
  offer_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  redeemed_at timestamptz,
  revenue_attributed numeric(10,2) not null default 0
);

create index if not exists offers_business_sent_at_idx
  on public.offers (business_id, sent_at desc);
create index if not exists offers_business_offer_type_idx
  on public.offers (business_id, offer_type);

create table if not exists public.followup_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  rule_type text not null check (
    rule_type in (
      'reservation_reminder',
      'post_visit_feedback',
      'review_push',
      'negative_feedback_route',
      'abandoned_booking'
    )
  ),
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists followup_rules_business_type_active_idx
  on public.followup_rules (business_id, rule_type, is_active);

drop trigger if exists followup_rules_touch_updated_at on public.followup_rules;
create trigger followup_rules_touch_updated_at
before update on public.followup_rules
for each row execute function public.touch_updated_at();

create table if not exists public.behavior_offer_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  condition jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists behavior_offer_rules_business_active_idx
  on public.behavior_offer_rules (business_id, is_active);

drop trigger if exists behavior_offer_rules_touch_updated_at on public.behavior_offer_rules;
create trigger behavior_offer_rules_touch_updated_at
before update on public.behavior_offer_rules
for each row execute function public.touch_updated_at();

create table if not exists public.channel_inboxes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'instagram')),
  external_account_id text not null,
  access_token_encrypted text,
  status text not null default 'pending' check (status in ('connected', 'disconnected', 'pending')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, channel)
);

create index if not exists channel_inboxes_business_channel_idx
  on public.channel_inboxes (business_id, channel);

drop trigger if exists channel_inboxes_touch_updated_at on public.channel_inboxes;
create trigger channel_inboxes_touch_updated_at
before update on public.channel_inboxes
for each row execute function public.touch_updated_at();

create table if not exists public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  inbox_id uuid not null references public.channel_inboxes(id) on delete cascade,
  external_message_id text,
  customer_id uuid references public.customers(id) on delete set null,
  direction text not null check (direction in ('in', 'out')),
  body text not null default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists channel_messages_business_inbox_created_idx
  on public.channel_messages (business_id, inbox_id, created_at desc);
create index if not exists channel_messages_business_customer_created_idx
  on public.channel_messages (business_id, customer_id, created_at desc);
create unique index if not exists channel_messages_inbox_external_unique
  on public.channel_messages (inbox_id, external_message_id)
  where external_message_id is not null;

create table if not exists public.outbox_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  send_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists outbox_messages_business_status_send_idx
  on public.outbox_messages (business_id, status, send_at);
create index if not exists outbox_messages_business_customer_created_idx
  on public.outbox_messages (business_id, customer_id, created_at desc);
create unique index if not exists outbox_messages_reservation_template_unique
  on public.outbox_messages (business_id, template_key, (payload ->> 'reservation_id'))
  where payload ? 'reservation_id';

create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  question text not null,
  answer text not null,
  category text,
  keywords text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists faq_entries_business_active_idx
  on public.faq_entries (business_id, is_active);
create index if not exists faq_entries_question_trgm_idx
  on public.faq_entries using gin (question gin_trgm_ops);

drop trigger if exists faq_entries_touch_updated_at on public.faq_entries;
create trigger faq_entries_touch_updated_at
before update on public.faq_entries
for each row execute function public.touch_updated_at();

create table if not exists public.objection_scripts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  objection_key text not null check (objection_key in ('too_expensive', 'dont_need', 'call_only', 'not_trust_ai')),
  response_text text not null,
  phrases text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, objection_key)
);

create index if not exists objection_scripts_business_active_idx
  on public.objection_scripts (business_id, is_active);

drop trigger if exists objection_scripts_touch_updated_at on public.objection_scripts;
create trigger objection_scripts_touch_updated_at
before update on public.objection_scripts
for each row execute function public.touch_updated_at();

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  tags jsonb not null default '[]'::jsonb,
  price numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_items_business_active_idx
  on public.catalog_items (business_id, is_active);
create index if not exists catalog_items_tags_gin_idx
  on public.catalog_items using gin (tags);

drop trigger if exists catalog_items_touch_updated_at on public.catalog_items;
create trigger catalog_items_touch_updated_at
before update on public.catalog_items
for each row execute function public.touch_updated_at();

alter table public.analytics_events
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists conversation_id uuid references public.chat_conversations(id) on delete set null,
  add column if not exists value_numeric numeric(10,2);

create index if not exists analytics_events_business_type_timestamp_idx
  on public.analytics_events (business_id, type, timestamp desc);
create index if not exists analytics_events_business_customer_timestamp_idx
  on public.analytics_events (business_id, customer_id, timestamp desc);
create index if not exists analytics_events_business_conversation_timestamp_idx
  on public.analytics_events (business_id, conversation_id, timestamp desc);

alter table public.customers enable row level security;
alter table public.customer_events enable row level security;
alter table public.lead_qualifications enable row level security;
alter table public.qualification_settings enable row level security;
alter table public.upsell_catalog enable row level security;
alter table public.offers enable row level security;
alter table public.followup_rules enable row level security;
alter table public.behavior_offer_rules enable row level security;
alter table public.channel_inboxes enable row level security;
alter table public.channel_messages enable row level security;
alter table public.outbox_messages enable row level security;
alter table public.faq_entries enable row level security;
alter table public.objection_scripts enable row level security;
alter table public.catalog_items enable row level security;

drop policy if exists customers_owner_all on public.customers;
create policy customers_owner_all on public.customers
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists customer_events_owner_all on public.customer_events;
create policy customer_events_owner_all on public.customer_events
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists lead_qualifications_owner_all on public.lead_qualifications;
create policy lead_qualifications_owner_all on public.lead_qualifications
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists qualification_settings_owner_all on public.qualification_settings;
create policy qualification_settings_owner_all on public.qualification_settings
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists upsell_catalog_owner_all on public.upsell_catalog;
create policy upsell_catalog_owner_all on public.upsell_catalog
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists offers_owner_all on public.offers;
create policy offers_owner_all on public.offers
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists followup_rules_owner_all on public.followup_rules;
create policy followup_rules_owner_all on public.followup_rules
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists behavior_offer_rules_owner_all on public.behavior_offer_rules;
create policy behavior_offer_rules_owner_all on public.behavior_offer_rules
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists channel_inboxes_owner_all on public.channel_inboxes;
create policy channel_inboxes_owner_all on public.channel_inboxes
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists channel_messages_owner_all on public.channel_messages;
create policy channel_messages_owner_all on public.channel_messages
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists outbox_messages_owner_all on public.outbox_messages;
create policy outbox_messages_owner_all on public.outbox_messages
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists faq_entries_owner_all on public.faq_entries;
create policy faq_entries_owner_all on public.faq_entries
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists objection_scripts_owner_all on public.objection_scripts;
create policy objection_scripts_owner_all on public.objection_scripts
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists catalog_items_owner_all on public.catalog_items;
create policy catalog_items_owner_all on public.catalog_items
for all using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create or replace function public.ensure_customer_for_business(
  p_business_id uuid,
  p_name text default null,
  p_email text default null,
  p_phone text default null,
  p_source_channel text default null
)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
begin
  if p_email is not null and btrim(p_email) <> '' then
    select * into v_customer
    from public.customers
    where business_id = p_business_id
      and lower(email) = lower(btrim(p_email))
    order by created_at asc
    limit 1;
  end if;

  if v_customer.id is null and p_phone is not null and btrim(p_phone) <> '' then
    select * into v_customer
    from public.customers
    where business_id = p_business_id
      and phone = btrim(p_phone)
    order by created_at asc
    limit 1;
  end if;

  if v_customer.id is null then
    insert into public.customers (
      business_id,
      name,
      email,
      phone,
      source_channel,
      last_seen_at
    )
    values (
      p_business_id,
      nullif(btrim(p_name), ''),
      nullif(lower(btrim(p_email)), ''),
      nullif(btrim(p_phone), ''),
      nullif(btrim(p_source_channel), ''),
      now()
    )
    returning * into v_customer;
  else
    update public.customers
    set
      name = coalesce(v_customer.name, nullif(btrim(p_name), '')),
      email = coalesce(v_customer.email, nullif(lower(btrim(p_email)), '')),
      phone = coalesce(v_customer.phone, nullif(btrim(p_phone), '')),
      source_channel = coalesce(v_customer.source_channel, nullif(btrim(p_source_channel), '')),
      last_seen_at = now(),
      updated_at = now()
    where id = v_customer.id
    returning * into v_customer;
  end if;

  return v_customer;
end;
$$;
