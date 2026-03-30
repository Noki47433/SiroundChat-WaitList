alter table if exists public.businesses
  add column if not exists access_approved boolean not null default false,
  add column if not exists onboarding_submitted boolean not null default false,
  add column if not exists onboarding_data jsonb not null default '{}'::jsonb;

update public.businesses
set access_approved = true
where coalesce(access_approved, false) = false
  and coalesce(launch_access, false) = true;

update public.businesses
set onboarding_submitted = true
where coalesce(onboarding_submitted, false) = false
  and (
    coalesce(onboarding_data, '{}'::jsonb) <> '{}'::jsonb
    or onboarding_completed_at is not null
  );
