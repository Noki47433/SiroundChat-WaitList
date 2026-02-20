-- Summary: Adds founder/admin dashboard schema, realtime feed tables, aggregate triggers, and admin-aware RLS.

create extension if not exists pgcrypto;

-- ========================
-- Profiles + role helpers
-- ========================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles(role);

insert into profiles (id, full_name, role)
select
  u.id,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.email)), ''),
  'user'
from auth.users u
on conflict (id) do nothing;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))), ''),
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_profile();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role <> old.role and not public.is_admin() then
    raise exception 'Only admins can change profile roles.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_role_escalation on profiles;
create trigger profiles_block_role_escalation
before update on profiles
for each row execute function public.prevent_profile_role_escalation();

-- ========================
-- Businesses compatibility
-- ========================
alter table businesses add column if not exists owner_user_id uuid;
alter table businesses add column if not exists name text;
alter table businesses add column if not exists phone text;
alter table businesses add column if not exists city text;
alter table businesses add column if not exists website_url text;
alter table businesses add column if not exists plan text not null default 'trial';
alter table businesses add column if not exists status text not null default 'active';

alter table businesses drop constraint if exists businesses_owner_user_id_fkey;
alter table businesses
  add constraint businesses_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete cascade;

update businesses
set owner_user_id = coalesce(owner_user_id, owner_id)
where owner_user_id is null;

update businesses
set owner_id = coalesce(owner_id, owner_user_id)
where owner_id is null;

update businesses
set name = coalesce(name, business_name)
where name is null;

create or replace function public.sync_business_owner_ids()
returns trigger
language plpgsql
as $$
begin
  new.owner_user_id := coalesce(new.owner_user_id, new.owner_id);
  new.owner_id := coalesce(new.owner_id, new.owner_user_id);
  new.name := coalesce(new.name, new.business_name);
  new.business_name := coalesce(new.business_name, new.name);
  return new;
end;
$$;

drop trigger if exists businesses_sync_owner_ids on businesses;
create trigger businesses_sync_owner_ids
before insert or update on businesses
for each row execute function public.sync_business_owner_ids();

create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from businesses b
    where b.id = target_business_id
      and coalesce(b.owner_user_id, b.owner_id) = auth.uid()
  );
$$;

-- ========================
-- Founder dashboard tables
-- ========================
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  channel text not null default 'web',
  visitor_id text,
  status text not null default 'open' check (status in ('open', 'closed', 'escalated')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  sender text not null check (sender in ('visitor', 'ai', 'human')),
  content text not null,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);

-- Upgrade existing leads table to founder fields.
alter table leads add column if not exists lead_type text;
alter table leads add column if not exists payload jsonb not null default '{}'::jsonb;

-- Keep old data compatible while enabling founder conversation linkage.
insert into conversations (id, business_id, channel, visitor_id, status, last_message_at, created_at)
select
  c.id,
  c.business_id,
  'web',
  c.user_name,
  case when c.takeover_enabled then 'escalated' else 'open' end,
  coalesce((select max(m.created_at) from chat_messages m where m.conversation_id = c.id), c.created_at),
  c.created_at
from chat_conversations c
on conflict (id) do update
set
  business_id = excluded.business_id,
  last_message_at = greatest(conversations.last_message_at, excluded.last_message_at);

insert into messages (id, conversation_id, business_id, sender, content, tokens_in, tokens_out, cost_usd, created_at)
select
  m.id,
  m.conversation_id,
  c.business_id,
  case
    when m.sender = 'user' then 'visitor'
    when m.sender in ('owner', 'agent') then 'human'
    else 'ai'
  end,
  m.message_text,
  0,
  0,
  0,
  m.created_at
from chat_messages m
join chat_conversations c on c.id = m.conversation_id
on conflict (id) do nothing;

alter table leads drop constraint if exists leads_conversation_id_fkey;
alter table leads
  add constraint leads_conversation_id_fkey
  foreign key (conversation_id) references conversations(id) on delete set null;

create table if not exists website_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  session_id text,
  source text,
  path text,
  created_at timestamptz not null default now()
);

alter table subscriptions add column if not exists provider text not null default 'stripe';
alter table subscriptions add column if not exists mrr_eur numeric(12, 2) not null default 0;
alter table subscriptions add column if not exists current_period_end timestamptz;
alter table subscriptions add column if not exists updated_at timestamptz not null default now();

create table if not exists events (
  id bigserial primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  severity text not null default 'info' check (severity in ('info', 'success', 'warn', 'danger')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists business_metrics_daily (
  business_id uuid not null references businesses(id) on delete cascade,
  day date not null,
  conversations_count int not null default 0,
  messages_count int not null default 0,
  ai_messages_count int not null default 0,
  human_messages_count int not null default 0,
  leads_count int not null default 0,
  visitors_count int not null default 0,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  ai_cost_usd numeric(12, 4) not null default 0,
  primary key (business_id, day)
);

create table if not exists business_metrics_realtime (
  business_id uuid primary key references businesses(id) on delete cascade,
  active_conversations int not null default 0,
  active_visitors int not null default 0,
  messages_last_10m int not null default 0,
  updated_at timestamptz not null default now()
);

-- ========================
-- Indexes
-- ========================
create index if not exists messages_business_created_idx on messages(business_id, created_at desc);
create index if not exists conversations_business_status_last_idx on conversations(business_id, status, last_message_at desc);
create index if not exists events_business_created_idx on events(business_id, created_at desc);
create index if not exists business_metrics_daily_day_idx on business_metrics_daily(day);
create index if not exists website_sessions_business_created_idx on website_sessions(business_id, created_at desc);

-- ========================
-- Trigger helpers
-- ========================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch_updated_at on subscriptions;
create trigger subscriptions_touch_updated_at
before update on subscriptions
for each row execute function public.touch_updated_at();

create or replace function public.refresh_business_realtime(target_business_id uuid)
returns void
language sql
as $$
  insert into business_metrics_realtime (
    business_id,
    active_conversations,
    active_visitors,
    messages_last_10m,
    updated_at
  )
  values (
    target_business_id,
    (
      select count(*)
      from conversations c
      where c.business_id = target_business_id
        and c.status = 'open'
    ),
    (
      select count(distinct ws.session_id)
      from website_sessions ws
      where ws.business_id = target_business_id
        and ws.created_at >= now() - interval '10 minutes'
    ),
    (
      select count(*)
      from messages m
      where m.business_id = target_business_id
        and m.created_at >= now() - interval '10 minutes'
    ),
    now()
  )
  on conflict (business_id) do update
  set
    active_conversations = excluded.active_conversations,
    active_visitors = excluded.active_visitors,
    messages_last_10m = excluded.messages_last_10m,
    updated_at = now();
$$;

create or replace function public.bump_daily_metrics(
  target_business_id uuid,
  target_day date,
  conv_inc int,
  msg_inc int,
  ai_msg_inc int,
  human_msg_inc int,
  lead_inc int,
  visitor_inc int,
  tokens_in_inc int,
  tokens_out_inc int,
  cost_inc numeric
)
returns void
language sql
as $$
  insert into business_metrics_daily (
    business_id,
    day,
    conversations_count,
    messages_count,
    ai_messages_count,
    human_messages_count,
    leads_count,
    visitors_count,
    tokens_in,
    tokens_out,
    ai_cost_usd
  )
  values (
    target_business_id,
    target_day,
    greatest(conv_inc, 0),
    greatest(msg_inc, 0),
    greatest(ai_msg_inc, 0),
    greatest(human_msg_inc, 0),
    greatest(lead_inc, 0),
    greatest(visitor_inc, 0),
    greatest(tokens_in_inc, 0),
    greatest(tokens_out_inc, 0),
    greatest(cost_inc, 0)
  )
  on conflict (business_id, day) do update
  set
    conversations_count = business_metrics_daily.conversations_count + conv_inc,
    messages_count = business_metrics_daily.messages_count + msg_inc,
    ai_messages_count = business_metrics_daily.ai_messages_count + ai_msg_inc,
    human_messages_count = business_metrics_daily.human_messages_count + human_msg_inc,
    leads_count = business_metrics_daily.leads_count + lead_inc,
    visitors_count = business_metrics_daily.visitors_count + visitor_inc,
    tokens_in = business_metrics_daily.tokens_in + tokens_in_inc,
    tokens_out = business_metrics_daily.tokens_out + tokens_out_inc,
    ai_cost_usd = business_metrics_daily.ai_cost_usd + cost_inc;
$$;

create or replace function public.handle_conversation_change()
returns trigger
language plpgsql
as $$
declare
  target_day date;
begin
  if tg_op = 'INSERT' then
    target_day := (new.created_at at time zone 'utc')::date;
    perform public.bump_daily_metrics(new.business_id, target_day, 1, 0, 0, 0, 0, 0, 0, 0, 0);
    perform public.refresh_business_realtime(new.business_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'escalated' and coalesce(old.status, '') <> 'escalated' then
      insert into events (business_id, type, title, body, severity, meta)
      values (
        new.business_id,
        'conversation.escalated',
        'Conversation escalated',
        'A conversation requires human takeover.',
        'warn',
        jsonb_build_object('conversation_id', new.id)
      );
    end if;

    perform public.refresh_business_realtime(new.business_id);
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists conversations_metrics_trg on conversations;
create trigger conversations_metrics_trg
after insert or update of status, last_message_at on conversations
for each row execute function public.handle_conversation_change();

create or replace function public.handle_message_insert()
returns trigger
language plpgsql
as $$
declare
  target_day date;
  ai_inc int;
  human_inc int;
begin
  target_day := (new.created_at at time zone 'utc')::date;
  ai_inc := case when new.sender = 'ai' then 1 else 0 end;
  human_inc := case when new.sender = 'human' then 1 else 0 end;

  perform public.bump_daily_metrics(
    new.business_id,
    target_day,
    0,
    1,
    ai_inc,
    human_inc,
    0,
    0,
    coalesce(new.tokens_in, 0),
    coalesce(new.tokens_out, 0),
    coalesce(new.cost_usd, 0)
  );

  insert into events (business_id, type, title, body, severity, meta)
  values (
    new.business_id,
    'message.received',
    'New message received',
    left(new.content, 180),
    'info',
    jsonb_build_object(
      'message_id', new.id,
      'conversation_id', new.conversation_id,
      'sender', new.sender
    )
  );

  update conversations
  set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
  where id = new.conversation_id;

  perform public.refresh_business_realtime(new.business_id);
  return new;
end;
$$;

drop trigger if exists messages_metrics_trg on messages;
create trigger messages_metrics_trg
after insert on messages
for each row execute function public.handle_message_insert();

create or replace function public.handle_lead_insert()
returns trigger
language plpgsql
as $$
declare
  target_day date;
  lead_name text;
begin
  target_day := (new.created_at at time zone 'utc')::date;
  lead_name := coalesce(nullif(trim(new.name), ''), 'New lead');

  perform public.bump_daily_metrics(new.business_id, target_day, 0, 0, 0, 0, 1, 0, 0, 0, 0);

  insert into events (business_id, type, title, body, severity, meta)
  values (
    new.business_id,
    'lead.created',
    'Lead captured',
    lead_name,
    'success',
    jsonb_build_object('lead_id', new.id, 'conversation_id', new.conversation_id)
  );

  return new;
end;
$$;

drop trigger if exists leads_metrics_trg on leads;
create trigger leads_metrics_trg
after insert on leads
for each row execute function public.handle_lead_insert();

create or replace function public.handle_website_session_insert()
returns trigger
language plpgsql
as $$
declare
  target_day date;
begin
  target_day := (new.created_at at time zone 'utc')::date;

  perform public.bump_daily_metrics(new.business_id, target_day, 0, 0, 0, 0, 0, 1, 0, 0, 0);
  perform public.refresh_business_realtime(new.business_id);

  return new;
end;
$$;

drop trigger if exists website_sessions_metrics_trg on website_sessions;
create trigger website_sessions_metrics_trg
after insert on website_sessions
for each row execute function public.handle_website_session_insert();

create or replace function public.handle_subscription_status_event()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status::text = 'past_due' and old.status::text <> 'past_due' then
    insert into events (business_id, type, title, body, severity, meta)
    values (
      new.business_id,
      'payment.failed',
      'Payment failed',
      'Subscription moved to past due.',
      'danger',
      jsonb_build_object('subscription_id', new.id, 'status', new.status::text)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists subscriptions_status_event_trg on subscriptions;
create trigger subscriptions_status_event_trg
after update of status on subscriptions
for each row execute function public.handle_subscription_status_event();

-- Sync legacy chat tables into founder tables for backward compatibility.
create or replace function public.sync_chat_conversation_to_founder()
returns trigger
language plpgsql
as $$
begin
  insert into conversations (id, business_id, channel, visitor_id, status, last_message_at, created_at)
  values (
    new.id,
    new.business_id,
    'web',
    new.user_name,
    case when new.takeover_enabled then 'escalated' else 'open' end,
    new.created_at,
    new.created_at
  )
  on conflict (id) do update
  set
    business_id = excluded.business_id,
    visitor_id = coalesce(excluded.visitor_id, conversations.visitor_id),
    status = case when excluded.status = 'escalated' then 'escalated' else conversations.status end;

  return new;
end;
$$;

drop trigger if exists chat_conversations_founder_sync_trg on chat_conversations;
create trigger chat_conversations_founder_sync_trg
after insert or update on chat_conversations
for each row execute function public.sync_chat_conversation_to_founder();

create or replace function public.sync_chat_message_to_founder()
returns trigger
language plpgsql
as $$
declare
  target_business_id uuid;
begin
  select c.business_id into target_business_id
  from chat_conversations c
  where c.id = new.conversation_id;

  if target_business_id is null then
    return new;
  end if;

  insert into messages (id, conversation_id, business_id, sender, content, tokens_in, tokens_out, cost_usd, created_at)
  values (
    new.id,
    new.conversation_id,
    target_business_id,
    case
      when new.sender = 'user' then 'visitor'
      when new.sender in ('owner', 'agent') then 'human'
      else 'ai'
    end,
    new.message_text,
    0,
    0,
    0,
    new.created_at
  )
  on conflict (id) do nothing;

  update conversations
  set last_message_at = greatest(last_message_at, new.created_at)
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists chat_messages_founder_sync_trg on chat_messages;
create trigger chat_messages_founder_sync_trg
after insert on chat_messages
for each row execute function public.sync_chat_message_to_founder();

-- ========================
-- RLS policies
-- ========================
alter table profiles enable row level security;
alter table businesses enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table leads enable row level security;
alter table events enable row level security;
alter table business_metrics_daily enable row level security;
alter table business_metrics_realtime enable row level security;
alter table subscriptions enable row level security;
alter table website_sessions enable row level security;

-- Profiles
create policy if not exists profiles_select_self on profiles
for select using (id = auth.uid());
create policy if not exists profiles_update_self on profiles
for update using (id = auth.uid())
with check (id = auth.uid());
create policy if not exists profiles_insert_self on profiles
for insert with check (id = auth.uid() and role = 'user');
create policy if not exists profiles_admin_all on profiles
for all using (is_admin()) with check (is_admin());

-- Businesses
create policy if not exists businesses_admin_all on businesses
for all using (is_admin()) with check (is_admin());
create policy if not exists businesses_owner_all on businesses
for all
using (is_business_owner(id))
with check (coalesce(owner_user_id, owner_id) = auth.uid());

-- Founder tables owner + admin.
create policy if not exists conversations_admin_all on conversations
for all using (is_admin()) with check (is_admin());
create policy if not exists conversations_owner_all on conversations
for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create policy if not exists messages_admin_all on messages
for all using (is_admin()) with check (is_admin());
create policy if not exists messages_owner_all on messages
for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create policy if not exists leads_admin_all on leads
for all using (is_admin()) with check (is_admin());
create policy if not exists leads_owner_all on leads
for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create policy if not exists events_admin_all on events
for all using (is_admin()) with check (is_admin());
create policy if not exists events_owner_select on events
for select using (is_business_owner(business_id));

create policy if not exists metrics_daily_admin_all on business_metrics_daily
for all using (is_admin()) with check (is_admin());
create policy if not exists metrics_daily_owner_select on business_metrics_daily
for select using (is_business_owner(business_id));

create policy if not exists metrics_realtime_admin_all on business_metrics_realtime
for all using (is_admin()) with check (is_admin());
create policy if not exists metrics_realtime_owner_select on business_metrics_realtime
for select using (is_business_owner(business_id));

create policy if not exists subscriptions_admin_all on subscriptions
for all using (is_admin()) with check (is_admin());
create policy if not exists subscriptions_owner_select on subscriptions
for select using (is_business_owner(business_id));

create policy if not exists website_sessions_admin_all on website_sessions
for all using (is_admin()) with check (is_admin());
create policy if not exists website_sessions_owner_all on website_sessions
for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

-- Ensure current business rows are visible to owners even if owner_user_id was null historically.
update businesses
set owner_user_id = coalesce(owner_user_id, owner_id)
where owner_user_id is null;

-- Seed daily metrics from current founder tables for a warm first dashboard load.
insert into business_metrics_daily (
  business_id,
  day,
  conversations_count,
  messages_count,
  ai_messages_count,
  human_messages_count,
  leads_count,
  visitors_count,
  tokens_in,
  tokens_out,
  ai_cost_usd
)
select
  b.id,
  current_date,
  coalesce(c.count_conversations, 0),
  coalesce(m.count_messages, 0),
  coalesce(m.count_ai, 0),
  coalesce(m.count_human, 0),
  coalesce(l.count_leads, 0),
  coalesce(ws.count_visitors, 0),
  coalesce(m.sum_tokens_in, 0),
  coalesce(m.sum_tokens_out, 0),
  coalesce(m.sum_cost, 0)
from businesses b
left join (
  select business_id, count(*) as count_conversations
  from conversations
  where created_at::date = current_date
  group by business_id
) c on c.business_id = b.id
left join (
  select
    business_id,
    count(*) as count_messages,
    count(*) filter (where sender = 'ai') as count_ai,
    count(*) filter (where sender = 'human') as count_human,
    coalesce(sum(tokens_in), 0) as sum_tokens_in,
    coalesce(sum(tokens_out), 0) as sum_tokens_out,
    coalesce(sum(cost_usd), 0) as sum_cost
  from messages
  where created_at::date = current_date
  group by business_id
) m on m.business_id = b.id
left join (
  select business_id, count(*) as count_leads
  from leads
  where created_at::date = current_date
  group by business_id
) l on l.business_id = b.id
left join (
  select business_id, count(*) as count_visitors
  from website_sessions
  where created_at::date = current_date
  group by business_id
) ws on ws.business_id = b.id
on conflict (business_id, day) do nothing;

insert into business_metrics_realtime (business_id, active_conversations, active_visitors, messages_last_10m, updated_at)
select
  b.id,
  coalesce((select count(*) from conversations c where c.business_id = b.id and c.status = 'open'), 0),
  coalesce((select count(distinct ws.session_id) from website_sessions ws where ws.business_id = b.id and ws.created_at >= now() - interval '10 minutes'), 0),
  coalesce((select count(*) from messages m where m.business_id = b.id and m.created_at >= now() - interval '10 minutes'), 0),
  now()
from businesses b
on conflict (business_id) do update
set
  active_conversations = excluded.active_conversations,
  active_visitors = excluded.active_visitors,
  messages_last_10m = excluded.messages_last_10m,
  updated_at = now();
