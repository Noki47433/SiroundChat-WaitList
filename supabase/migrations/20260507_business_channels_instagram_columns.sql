-- Summary: Adds Instagram routing columns to business channels for Meta DM support.

alter table public.business_channels
  add column if not exists instagram_business_account_id text,
  add column if not exists instagram_page_id text;

create index if not exists business_channels_instagram_business_account_id_idx
  on public.business_channels (instagram_business_account_id);

create index if not exists business_channels_instagram_page_id_idx
  on public.business_channels (instagram_page_id);
