-- Summary: Adds per-business reservation SMS alert settings without changing existing business access rules.

alter table public.businesses
  add column if not exists sms_alert_phone text,
  add column if not exists sms_alerts_enabled boolean not null default false;
