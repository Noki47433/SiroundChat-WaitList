-- Summary: Adds onboarding_complete flag to users to track setup progress. Core to gating onboarding steps; removing it makes onboarding checks impossible.
alter table users add column if not exists onboarding_complete boolean default false;
