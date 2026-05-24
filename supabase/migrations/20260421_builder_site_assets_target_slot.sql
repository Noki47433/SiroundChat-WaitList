alter table public.builder_site_assets
  add column if not exists target_slot text;

update public.builder_site_assets
set target_slot = case
  when kind = 'hero' then 'hero'
  when kind = 'gallery' then 'gallery'
  else 'auto'
end
where target_slot is null;

alter table public.builder_site_assets
  alter column target_slot set default 'auto';

alter table public.builder_site_assets
  alter column target_slot set not null;

alter table public.builder_site_assets
  drop constraint if exists builder_site_assets_target_slot_check;

alter table public.builder_site_assets
  add constraint builder_site_assets_target_slot_check
  check (target_slot in ('auto', 'hero', 'gallery', 'story', 'menu', 'reservation'));

create index if not exists builder_site_assets_site_slot_idx
  on public.builder_site_assets(site_id, target_slot);
