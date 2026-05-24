insert into public.billing_plans (id, name, price_cents, currency, interval)
values
  ('website_only', 'Website Only', 1999, 'EUR', 'month'),
  ('chatbot_only', 'AI Chatbot Only', 1999, 'EUR', 'month'),
  ('website_chatbot', 'Website + AI', 3499, 'EUR', 'month'),
  ('social_inbox', 'Social Inbox', 2999, 'EUR', 'month'),
  ('omni_channel', 'Full Omni-Channel', 4999, 'EUR', 'month')
on conflict (id) do update
set
  name = excluded.name,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  interval = excluded.interval;

alter table if exists public.businesses
  add column if not exists billing_override_plan_id text null references public.billing_plans(id) on delete set null,
  add column if not exists billing_override_reason text null,
  add column if not exists billing_override_granted_by_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists billing_override_granted_at timestamptz null,
  add column if not exists billing_override_expires_at timestamptz null;

create index if not exists businesses_billing_override_plan_idx
  on public.businesses (billing_override_plan_id);

create index if not exists businesses_billing_override_expiry_idx
  on public.businesses (billing_override_expires_at);
