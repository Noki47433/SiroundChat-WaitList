-- Summary: Adds website analytics events table for website insights dashboard.

create table if not exists website_analytics_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  site_id uuid null references builder_sites(id) on delete set null,
  page_path text not null,
  page_title text null,
  event_type text not null check (
    event_type in (
      'page_view',
      'cta_click',
      'lead_submitted',
      'chat_open',
      'chat_started'
    )
  ),
  channel text not null check (channel in ('website', 'chatbot', 'form')),
  cta_type text null check (cta_type in ('call', 'whatsapp', 'email', 'directions', 'booking', 'other')),
  lead_type text null check (lead_type in ('form', 'chat')),
  lead_id uuid null references leads(id) on delete set null,
  session_id text not null,
  user_agent text null,
  referrer text null,
  country_code text null,
  city text null,
  occurred_at timestamptz not null default now()
);

create index if not exists website_analytics_events_business_occurred_idx
  on website_analytics_events(business_id, occurred_at desc);
create index if not exists website_analytics_events_business_type_occurred_idx
  on website_analytics_events(business_id, event_type, occurred_at desc);
create index if not exists website_analytics_events_business_page_occurred_idx
  on website_analytics_events(business_id, page_path, occurred_at desc);
create index if not exists website_analytics_events_business_country_occurred_idx
  on website_analytics_events(business_id, country_code, occurred_at desc);

alter table website_analytics_events enable row level security;
create policy if not exists "website_analytics_select_owner" on website_analytics_events
for select using (is_business_owner(business_id));
create policy if not exists "website_analytics_insert_owner" on website_analytics_events
for insert with check (is_business_owner(business_id));
create policy if not exists "website_analytics_update_owner" on website_analytics_events
for update using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create policy if not exists "website_analytics_delete_owner" on website_analytics_events
for delete using (is_business_owner(business_id));
