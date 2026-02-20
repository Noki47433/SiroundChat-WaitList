-- Summary: Adds Website Builder tables with ownership enforcement and publish tracking.

create table if not exists builder_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'published')),
  industry text not null,
  business_name text not null,
  description text not null,
  brand_color text null,
  contact_email text null,
  include_reservation boolean not null default false,
  template_key text not null check (template_key in ('generic', 'restaurant', 'consulting')),
  content_json jsonb not null default '{}'::jsonb,
  assets_json jsonb not null default '{}'::jsonb,
  subdomain text null unique,
  published_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists builder_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references builder_sites(id) on delete cascade,
  domain text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create or replace function set_builder_sites_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists builder_sites_set_updated_at on builder_sites;
create trigger builder_sites_set_updated_at
before update on builder_sites
for each row execute function set_builder_sites_updated_at();

alter table builder_sites enable row level security;
create policy if not exists "builder_sites_select_owner" on builder_sites
for select using (user_id = auth.uid());
create policy if not exists "builder_sites_insert_owner" on builder_sites
for insert with check (user_id = auth.uid());
create policy if not exists "builder_sites_update_owner" on builder_sites
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy if not exists "builder_sites_delete_owner" on builder_sites
for delete using (user_id = auth.uid());

alter table builder_domains enable row level security;
create policy if not exists "builder_domains_select_owner" on builder_domains
for select using (
  exists (
    select 1 from builder_sites
    where builder_sites.id = builder_domains.site_id
      and builder_sites.user_id = auth.uid()
  )
);
create policy if not exists "builder_domains_insert_owner" on builder_domains
for insert with check (
  exists (
    select 1 from builder_sites
    where builder_sites.id = builder_domains.site_id
      and builder_sites.user_id = auth.uid()
  )
);
create policy if not exists "builder_domains_update_owner" on builder_domains
for update using (
  exists (
    select 1 from builder_sites
    where builder_sites.id = builder_domains.site_id
      and builder_sites.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from builder_sites
    where builder_sites.id = builder_domains.site_id
      and builder_sites.user_id = auth.uid()
  )
);
create policy if not exists "builder_domains_delete_owner" on builder_domains
for delete using (
  exists (
    select 1 from builder_sites
    where builder_sites.id = builder_domains.site_id
      and builder_sites.user_id = auth.uid()
  )
);
