alter table if exists public.businesses
  add column if not exists dashboard_onboarding_state jsonb not null default '{}'::jsonb;
