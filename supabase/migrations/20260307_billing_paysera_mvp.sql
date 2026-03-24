-- Paysera billing MVP: plans, subscriptions, payments, indexes, triggers, and RLS.

create extension if not exists pgcrypto;

create table if not exists billing_plans (
  id text primary key,
  name text not null,
  price_cents int not null check (price_cents >= 0),
  currency text not null default 'EUR',
  interval text not null default 'month',
  created_at timestamptz not null default now()
);

create table if not exists billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  plan_id text not null references billing_plans(id),
  status text not null check (status in ('pending_setup', 'trialing', 'active', 'past_due', 'canceled')),
  trial_end timestamptz null,
  current_period_end timestamptz null,
  paysera_issued_token text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references billing_subscriptions(id) on delete cascade,
  kind text not null check (kind in ('setup', 'renewal')),
  amount_cents int not null check (amount_cents > 0),
  currency text not null,
  paysera_orderid text not null,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  raw_callback jsonb null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_subscriptions_business_id_key'
  ) then
    alter table billing_subscriptions
      add constraint billing_subscriptions_business_id_key unique (business_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_payments_paysera_orderid_key'
  ) then
    alter table billing_payments
      add constraint billing_payments_paysera_orderid_key unique (paysera_orderid);
  end if;
end;
$$;

create index if not exists billing_subscriptions_business_id_idx
  on billing_subscriptions (business_id);

create index if not exists billing_subscriptions_status_idx
  on billing_subscriptions (status);

create index if not exists billing_subscriptions_current_period_end_idx
  on billing_subscriptions (current_period_end);

create index if not exists billing_payments_subscription_created_idx
  on billing_payments (subscription_id, created_at desc);

create unique index if not exists billing_payments_pending_renewal_unique_idx
  on billing_payments (subscription_id, kind)
  where kind = 'renewal' and status = 'pending';

create or replace function public.set_billing_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists billing_subscriptions_set_updated_at on billing_subscriptions;
create trigger billing_subscriptions_set_updated_at
before update on billing_subscriptions
for each row execute function public.set_billing_subscriptions_updated_at();

insert into billing_plans (id, name, price_cents, currency, interval)
values
  ('website_19', 'Website', 1900, 'EUR', 'month'),
  ('chatbot_19', 'Chatbot', 1900, 'EUR', 'month'),
  ('bundle_29', 'Bundle', 2900, 'EUR', 'month')
on conflict (id) do update
set
  name = excluded.name,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  interval = excluded.interval;

alter table billing_plans enable row level security;
alter table billing_subscriptions enable row level security;
alter table billing_payments enable row level security;

drop policy if exists billing_plans_select_authenticated on billing_plans;
create policy billing_plans_select_authenticated
on billing_plans
for select
using (auth.role() = 'authenticated');

drop policy if exists billing_subscriptions_select_owner on billing_subscriptions;
create policy billing_subscriptions_select_owner
on billing_subscriptions
for select
using (is_business_owner(business_id));

drop policy if exists billing_payments_select_owner on billing_payments;
create policy billing_payments_select_owner
on billing_payments
for select
using (
  exists (
    select 1
    from billing_subscriptions s
    where s.id = billing_payments.subscription_id
      and is_business_owner(s.business_id)
  )
);
