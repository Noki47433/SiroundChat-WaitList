-- Demo billing model aligned to existing businesses tenancy.
create extension if not exists pgcrypto;

-- 1) Plan enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_id_enum') then
    create type plan_id_enum as enum ('website', 'bundle', 'chatbot');
  else
    alter type plan_id_enum add value if not exists 'chatbot';
  end if;
end;
$$;

-- 2) Subscription status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled');
  end if;
end;
$$;

-- 3) Subscriptions table shape (adapted: workspace_id -> business_id)
alter table if exists subscriptions
  add column if not exists plan_id plan_id_enum,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'plan'
  ) then
    update subscriptions
    set plan_id = case
      when plan::text = 'enterprise' then 'chatbot'::plan_id_enum
      when plan::text = 'pro' then 'bundle'::plan_id_enum
      else 'website'::plan_id_enum
    end
    where plan_id is null;
  end if;
end;
$$;

update subscriptions
set plan_id = 'website'::plan_id_enum
where plan_id is null;

update subscriptions
set plan_id = 'chatbot'::plan_id_enum
where plan_id::text = 'enterprise';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'plan'
  ) then
    update subscriptions
    set plan = case
      when plan_id = 'chatbot' then 'pro'::plan
      when plan_id = 'bundle' then 'pro'::plan
      else 'local_basic'::plan
    end;
  end if;
end;
$$;

update subscriptions
set current_period_start = coalesce(current_period_start, created_at, now())
where current_period_start is null;

update subscriptions
set current_period_end = coalesce(current_period_end, renewal_date, now() + interval '30 days')
where current_period_end is null;

update subscriptions
set created_at = coalesce(created_at, now())
where created_at is null;

update subscriptions
set updated_at = coalesce(updated_at, now())
where updated_at is null;

update subscriptions
set status = 'active'
where status is null;

delete from subscriptions where business_id is null;

with ranked as (
  select
    id,
    row_number() over (
      partition by business_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from subscriptions
)
delete from subscriptions s
using ranked r
where s.id = r.id
  and r.rn > 1;

alter table subscriptions
  alter column business_id set not null,
  alter column plan_id set not null,
  alter column plan_id set default 'website'::plan_id_enum,
  alter column status set default 'active'::subscription_status,
  alter column current_period_start set not null,
  alter column current_period_start set default now(),
  alter column current_period_end set not null,
  alter column current_period_end set default (now() + interval '30 days'),
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now();

alter table subscriptions
  drop constraint if exists subscriptions_business_id_unique;

alter table subscriptions
  add constraint subscriptions_business_id_unique unique (business_id);

-- 4) Billing audit events
create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_events_business_created_idx
  on billing_events (business_id, created_at desc);

-- 5) RLS + policies
alter table subscriptions enable row level security;
alter table billing_events enable row level security;

drop policy if exists subscriptions_admin_all on subscriptions;
drop policy if exists subscriptions_owner_select on subscriptions;
drop policy if exists subscriptions_select_member on subscriptions;

create policy subscriptions_select_member
on subscriptions
for select
using (
  is_business_owner(business_id)
  or exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists billing_events_select_member on billing_events;

create policy billing_events_select_member
on billing_events
for select
using (
  business_id is not null
  and (
    is_business_owner(business_id)
    or exists (
      select 1
      from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
);

-- 6) SECURITY DEFINER plan change RPC (adapted: workspace_id -> business_id)
create or replace function change_workspace_plan(p_workspace_id uuid, p_plan_id plan_id_enum)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_owner boolean := false;
  v_is_admin boolean := false;
  v_old_plan plan_id_enum;
  v_subscription subscriptions%rowtype;
begin
  if p_workspace_id is null then
    raise exception 'workspace_id is required' using errcode = '22023';
  end if;

  select exists (
    select 1
    from businesses b
    where b.id = p_workspace_id
      and coalesce(b.owner_user_id, b.owner_id) = v_actor_id
  )
  into v_is_owner;

  select exists (
    select 1
    from profiles p
    where p.id = v_actor_id
      and p.role = 'admin'
  )
  into v_is_admin;

  if not (v_is_owner or v_is_admin) then
    raise exception 'Not authorized to change this workspace plan' using errcode = '42501';
  end if;

  select s.plan_id
  into v_old_plan
  from subscriptions s
  where s.business_id = p_workspace_id;

  insert into subscriptions (
    business_id,
    plan,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    created_at,
    updated_at
  )
  values (
    p_workspace_id,
    case
      when p_plan_id = 'chatbot' then 'pro'::plan
      when p_plan_id = 'bundle' then 'pro'::plan
      else 'local_basic'::plan
    end,
    p_plan_id,
    'active',
    now(),
    now() + interval '30 days',
    false,
    now(),
    now()
  )
  on conflict (business_id) do update
  set
    plan = case
      when excluded.plan_id = 'chatbot' then 'pro'::plan
      when excluded.plan_id = 'bundle' then 'pro'::plan
      else 'local_basic'::plan
    end,
    plan_id = excluded.plan_id,
    status = 'active',
    cancel_at_period_end = false,
    updated_at = now()
  returning * into v_subscription;

  insert into billing_events (business_id, actor_user_id, event_type, payload)
  values (
    p_workspace_id,
    v_actor_id,
    'plan_changed',
    jsonb_build_object(
      'old_plan', v_old_plan,
      'new_plan', v_subscription.plan_id
    )
  );

  return v_subscription;
end;
$$;

-- 8) Ensure every business/workspace has a default subscription.
insert into subscriptions (
  business_id,
  plan,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at,
  updated_at
)
select
  b.id,
  'local_basic'::plan,
  'website'::plan_id_enum,
  'active'::subscription_status,
  now(),
  now() + interval '30 days',
  false,
  now(),
  now()
from businesses b
left join subscriptions s on s.business_id = b.id
where s.business_id is null
on conflict (business_id) do nothing;

create or replace function public.create_default_subscription_for_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into subscriptions (
    business_id,
    plan,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    created_at,
    updated_at
  )
  values (
    new.id,
    'local_basic'::plan,
    'website'::plan_id_enum,
    'active'::subscription_status,
    now(),
    now() + interval '30 days',
    false,
    now(),
    now()
  )
  on conflict (business_id) do nothing;

  return new;
end;
$$;

drop trigger if exists businesses_default_subscription_trg on businesses;
create trigger businesses_default_subscription_trg
after insert on businesses
for each row execute function public.create_default_subscription_for_business();
