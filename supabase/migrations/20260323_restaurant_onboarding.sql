-- Summary: Adds launch-safe restaurant onboarding storage directly to businesses.

alter table public.businesses
  add column if not exists onboarding_data jsonb not null default '{}'::jsonb,
  add column if not exists generated_starter_knowledge text,
  add column if not exists onboarding_completed_at timestamptz;
