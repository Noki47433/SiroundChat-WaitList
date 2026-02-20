-- Summary: Aligns website builder schema with real builder data model + submissions.

create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'builder_sites' and column_name = 'user_id'
  ) then
    execute 'alter table builder_sites rename column user_id to owner_user_id';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_name = 'builder_sites' and column_name = 'brand_color'
  ) then
    execute 'alter table builder_sites rename column brand_color to primary_color';
  end if;
end $$;

alter table if exists builder_sites
  add column if not exists business_id uuid,
  add column if not exists slug text,
  add column if not exists path text,
  add column if not exists secondary_color text,
  add column if not exists font_family text,
  add column if not exists logo_url text,
  add column if not exists contact_phone text,
  add column if not exists contact_address text,
  add column if not exists include_gallery boolean not null default false;

-- Backfill businesses for legacy builder sites.
insert into businesses (owner_id, business_name, industry)
select distinct
  bs.owner_user_id,
  coalesce(nullif(bs.business_name, ''), 'Your business'),
  nullif(bs.industry, '')
from builder_sites bs
left join businesses b on b.owner_id = bs.owner_user_id
where bs.owner_user_id is not null and b.id is null;

update builder_sites bs
set business_id = b.id
from businesses b
where bs.business_id is null and b.owner_id = bs.owner_user_id;

update builder_sites
set template_key = case
  when template_key = 'restaurant' then 'restaurant_v1'
  when template_key = 'consulting' then 'service_v1'
  when template_key = 'generic' then 'generic_v1'
  when template_key in ('restaurant_v1', 'service_v1', 'generic_v1') then template_key
  else 'generic_v1'
end;

update builder_sites set status = 'draft' where status = 'publishing';

update builder_sites
set logo_url = assets_json->>'logo'
where logo_url is null
  and assets_json ? 'logo';

with base as (
  select
    id,
    coalesce(
      nullif(slug, ''),
      nullif(subdomain, ''),
      nullif(regexp_replace(lower(business_name), '[^a-z0-9]+', '-', 'g'), ''),
      'site'
    ) as base_slug,
    created_at
  from builder_sites
),
ranked as (
  select
    id,
    base_slug,
    row_number() over (partition by base_slug order by created_at nulls last, id) as rn
  from base
)
update builder_sites bs
set slug = case
  when r.rn = 1 then r.base_slug
  else r.base_slug || '-' || substring(bs.id::text from 1 for 4)
end
from ranked r
where bs.id = r.id;

update builder_sites
set path = '/s/' || slug
where path is null or path = '';

alter table builder_sites drop constraint if exists builder_sites_status_check;
alter table builder_sites
  add constraint builder_sites_status_check
  check (status in ('draft', 'published', 'error'));

alter table builder_sites drop constraint if exists builder_sites_template_key_check;
alter table builder_sites
  add constraint builder_sites_template_key_check
  check (template_key in ('restaurant_v1', 'service_v1', 'generic_v1'));

alter table builder_sites drop constraint if exists builder_sites_user_id_fkey;
alter table builder_sites drop constraint if exists builder_sites_owner_user_id_fkey;
alter table builder_sites
  add constraint builder_sites_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete cascade;

alter table builder_sites drop constraint if exists builder_sites_business_id_fkey;
alter table builder_sites
  add constraint builder_sites_business_id_fkey
  foreign key (business_id) references businesses(id) on delete cascade;

alter table builder_sites alter column business_id set not null;
alter table builder_sites alter column slug set not null;
alter table builder_sites alter column path set not null;
alter table builder_sites alter column owner_user_id set not null;

create index if not exists builder_sites_business_id_idx on builder_sites(business_id);
create unique index if not exists builder_sites_slug_unique on builder_sites(slug);

-- Replace builder_sites policies to use business ownership.
alter table builder_sites enable row level security;
drop policy if exists builder_sites_select_owner on builder_sites;
drop policy if exists builder_sites_insert_owner on builder_sites;
drop policy if exists builder_sites_update_owner on builder_sites;
drop policy if exists builder_sites_delete_owner on builder_sites;
create policy builder_sites_select_owner on builder_sites
for select using (is_business_owner(business_id));
create policy builder_sites_insert_owner on builder_sites
for insert with check (is_business_owner(business_id));
create policy builder_sites_update_owner on builder_sites
for update using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create policy builder_sites_delete_owner on builder_sites
for delete using (is_business_owner(business_id));

-- Builder site content.
create table if not exists builder_site_content (
  site_id uuid primary key references builder_sites(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  content jsonb not null,
  seo_title text null,
  seo_description text null,
  updated_at timestamptz not null default now()
);
create index if not exists builder_site_content_business_id_idx on builder_site_content(business_id);

create or replace function set_builder_site_content_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists builder_site_content_set_updated_at on builder_site_content;
create trigger builder_site_content_set_updated_at
before update on builder_site_content
for each row execute function set_builder_site_content_updated_at();

alter table builder_site_content enable row level security;
create policy if not exists builder_site_content_select_owner on builder_site_content
for select using (is_business_owner(business_id));
create policy if not exists builder_site_content_insert_owner on builder_site_content
for insert with check (is_business_owner(business_id));
create policy if not exists builder_site_content_update_owner on builder_site_content
for update using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create policy if not exists builder_site_content_delete_owner on builder_site_content
for delete using (is_business_owner(business_id));

-- Builder site assets.
create table if not exists builder_site_assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references builder_sites(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('logo', 'hero', 'gallery', 'other')),
  url text not null,
  created_at timestamptz not null default now()
);
create index if not exists builder_site_assets_site_id_idx on builder_site_assets(site_id);
create index if not exists builder_site_assets_business_id_idx on builder_site_assets(business_id);

alter table builder_site_assets enable row level security;
create policy if not exists builder_site_assets_select_owner on builder_site_assets
for select using (is_business_owner(business_id));
create policy if not exists builder_site_assets_insert_owner on builder_site_assets
for insert with check (is_business_owner(business_id));
create policy if not exists builder_site_assets_update_owner on builder_site_assets
for update using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create policy if not exists builder_site_assets_delete_owner on builder_site_assets
for delete using (is_business_owner(business_id));

-- Site form submissions (contact/reservation).
create table if not exists site_form_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references builder_sites(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  form_type text not null check (form_type in ('contact', 'reservation')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists site_form_submissions_site_created_idx
  on site_form_submissions(site_id, created_at desc);
create index if not exists site_form_submissions_business_created_idx
  on site_form_submissions(business_id, created_at desc);

alter table site_form_submissions enable row level security;
drop policy if exists site_form_submissions_select_owner on site_form_submissions;
create policy site_form_submissions_select_owner on site_form_submissions
for select using (is_business_owner(business_id));

-- Update builder_domains policies to use business ownership.
alter table builder_domains enable row level security;
drop policy if exists builder_domains_select_owner on builder_domains;
drop policy if exists builder_domains_insert_owner on builder_domains;
drop policy if exists builder_domains_update_owner on builder_domains;
drop policy if exists builder_domains_delete_owner on builder_domains;
create policy builder_domains_select_owner on builder_domains
for select using (
  exists (
    select 1 from builder_sites
    where builder_sites.id = builder_domains.site_id
      and is_business_owner(builder_sites.business_id)
  )
);
create policy builder_domains_insert_owner on builder_domains
for insert with check (
  exists (
    select 1 from builder_sites
    where builder_sites.id = builder_domains.site_id
      and is_business_owner(builder_sites.business_id)
  )
);
create policy builder_domains_update_owner on builder_domains
for update using (
  exists (
    select 1 from builder_sites
    where builder_sites.id = builder_domains.site_id
      and is_business_owner(builder_sites.business_id)
  )
) with check (
  exists (
    select 1 from builder_sites
    where builder_sites.id = builder_domains.site_id
      and is_business_owner(builder_sites.business_id)
  )
);
create policy builder_domains_delete_owner on builder_domains
for delete using (
  exists (
    select 1 from builder_sites
    where builder_sites.id = builder_domains.site_id
      and is_business_owner(builder_sites.business_id)
  )
);

-- Website builder v2 fields.
alter table if exists builder_sites
  add column if not exists template_id text,
  add column if not exists tone text,
  add column if not exists pages_mode text,
  add column if not exists has_own_photos boolean not null default false,
  add column if not exists opening_hours text,
  add column if not exists socials jsonb,
  add column if not exists include_services boolean not null default true,
  add column if not exists include_testimonials boolean not null default false,
  add column if not exists include_pricing boolean not null default false,
  add column if not exists include_faq boolean not null default false,
  add column if not exists include_contact boolean not null default true,
  add column if not exists site_document jsonb;

update builder_sites
set template_id = case
  when template_id is not null then template_id
  when template_key = 'restaurant_v1' then 'restaurant-editorial'
  when template_key = 'service_v1' then 'corporate-sleek'
  else 'auto-modern'
end
where template_id is null;
