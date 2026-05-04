-- Summary: Adds WhatsApp channel routing, inbox conversation/message metadata, and reservation source linkage.

create extension if not exists pgcrypto;

create table if not exists public.business_channels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel_type text not null check (channel_type in ('website', 'whatsapp', 'instagram')),
  provider text not null default 'meta',
  status text not null default 'connected' check (status in ('connected', 'disabled', 'needs_reauth')),
  whatsapp_phone_number_id text,
  whatsapp_business_account_id text,
  display_phone_number text,
  auto_reply_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_channels_whatsapp_phone_number_id_idx
  on public.business_channels (whatsapp_phone_number_id);
create index if not exists business_channels_business_channel_type_idx
  on public.business_channels (business_id, channel_type);

drop trigger if exists business_channels_touch_updated_at on public.business_channels;
create trigger business_channels_touch_updated_at
before update on public.business_channels
for each row execute function public.touch_updated_at();

alter table public.conversations
  add column if not exists channel_type text,
  add column if not exists external_customer_id text,
  add column if not exists customer_display_name text,
  add column if not exists intent text,
  add column if not exists reservation_draft jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists linked_reservation_id uuid null,
  add column if not exists last_message_preview text,
  add column if not exists updated_at timestamptz not null default now();

update public.conversations
set channel_type = case
  when coalesce(channel, 'web') = 'whatsapp' then 'whatsapp'
  when coalesce(channel, 'web') = 'instagram' then 'instagram'
  else 'website'
end
where channel_type is null;

update public.conversations
set customer_display_name = coalesce(customer_display_name, visitor_id)
where customer_display_name is null;

update public.conversations
set last_message_preview = coalesce(last_message_preview, '')
where last_message_preview is null;

alter table public.conversations
  alter column channel_type set default 'website';

do $$
declare
  status_constraint_name text;
begin
  select conname
    into status_constraint_name
  from pg_constraint
  where conrelid = 'public.conversations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if status_constraint_name is not null then
    execute format('alter table public.conversations drop constraint if exists %I', status_constraint_name);
  end if;
end $$;

alter table public.conversations
  add constraint conversations_status_check
  check (status in ('open', 'closed', 'escalated', 'bot', 'human'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_linked_reservation_id_fkey'
      and conrelid = 'public.conversations'::regclass
  ) then
    alter table public.conversations
      add constraint conversations_linked_reservation_id_fkey
      foreign key (linked_reservation_id) references public.reservations(id) on delete set null;
  end if;
end $$;

create index if not exists conversations_business_external_customer_channel_idx
  on public.conversations (business_id, external_customer_id, channel_type);
create index if not exists conversations_business_last_message_at_desc_idx
  on public.conversations (business_id, last_message_at desc);
create index if not exists conversations_linked_reservation_id_idx
  on public.conversations (linked_reservation_id);

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
before update on public.conversations
for each row execute function public.touch_updated_at();

alter table public.messages
  add column if not exists direction text,
  add column if not exists body text,
  add column if not exists provider_message_id text,
  add column if not exists raw_payload jsonb;

update public.messages
set direction = case
  when sender = 'visitor' then 'inbound'
  else 'outbound'
end
where direction is null;

update public.messages
set body = coalesce(body, content)
where body is null;

update public.messages
set raw_payload = '{}'::jsonb
where raw_payload is null;

do $$
declare
  direction_constraint_name text;
begin
  select conname
    into direction_constraint_name
  from pg_constraint
  where conrelid = 'public.messages'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%direction%';

  if direction_constraint_name is not null then
    execute format('alter table public.messages drop constraint if exists %I', direction_constraint_name);
  end if;
end $$;

alter table public.messages
  add constraint messages_direction_check
  check (direction in ('inbound', 'outbound'));

create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at);
create index if not exists messages_provider_message_id_idx
  on public.messages (provider_message_id);

alter table public.reservations
  add column if not exists source text,
  add column if not exists source_conversation_id uuid null,
  add column if not exists special_request text;

update public.reservations
set source = case
  when created_by = 'dashboard' or created_by = 'phone' then 'manual'
  when created_by = 'chatbot' or created_by = 'widget' then 'website'
  else 'website'
end
where source is null;

update public.reservations
set special_request = coalesce(special_request, notes)
where special_request is null;

alter table public.reservations
  alter column source set default 'website';

do $$
declare
  source_constraint_name text;
begin
  select conname
    into source_constraint_name
  from pg_constraint
  where conrelid = 'public.reservations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%source%';

  if source_constraint_name is not null then
    execute format('alter table public.reservations drop constraint if exists %I', source_constraint_name);
  end if;
end $$;

alter table public.reservations
  add constraint reservations_source_check
  check (source in ('website', 'whatsapp', 'manual'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_source_conversation_id_fkey'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      add constraint reservations_source_conversation_id_fkey
      foreign key (source_conversation_id) references public.conversations(id) on delete set null;
  end if;
end $$;

create index if not exists reservations_source_idx
  on public.reservations (business_id, source, created_at desc);
create index if not exists reservations_source_conversation_id_idx
  on public.reservations (source_conversation_id);

alter table public.business_channels enable row level security;

drop policy if exists business_channels_admin_all on public.business_channels;
create policy business_channels_admin_all on public.business_channels
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists business_channels_owner_all on public.business_channels;
create policy business_channels_owner_all on public.business_channels
for all using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));
