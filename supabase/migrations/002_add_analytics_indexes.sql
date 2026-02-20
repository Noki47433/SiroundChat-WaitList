-- Summary: Adds analytics event table and index to support dashboard charts and queries.
-- Core because analytics views read from this; without it tracking and reporting break.
create table if not exists analytics_events (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  site_id uuid references websites(id),
  type text not null,
  session_id text,
  url text,
  timestamp timestamptz default now(),
  metadata jsonb
);
-- Composite index keeps per-site time-range queries fast; dropping it would slow dashboards.
create index if not exists analytics_events_site_id_timestamp_idx on analytics_events(site_id, timestamp);
