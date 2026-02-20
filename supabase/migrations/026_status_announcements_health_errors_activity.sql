-- Summary: Adds public status page, in-app announcements, weekly business health metrics/benchmarks,
-- error ingestion/grouping, and admin activity feed tables with RLS.

create extension if not exists pgcrypto;

-- =======================================
-- 1) Public status page
-- =======================================
create table if not exists public.system_components (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key text not null unique,
  name text not null,
  description text,
  is_public boolean not null default true,
  sort_order int not null default 0
);

create index if not exists system_components_sort_order_idx on public.system_components(sort_order);

create table if not exists public.status_incidents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  status text not null default 'investigating' check (status in ('investigating', 'identified', 'monitoring', 'resolved')),
  severity text not null default 'minor' check (severity in ('minor', 'major', 'critical')),
  title text not null,
  summary text not null,
  is_public boolean not null default true
);

create index if not exists status_incidents_started_at_desc_idx on public.status_incidents(started_at desc);
create index if not exists status_incidents_resolved_at_idx on public.status_incidents(resolved_at);
create index if not exists status_incidents_status_idx on public.status_incidents(status);

create table if not exists public.status_incident_components (
  incident_id uuid not null references public.status_incidents(id) on delete cascade,
  component_id uuid not null references public.system_components(id) on delete cascade,
  impact text not null default 'degraded' check (impact in ('degraded', 'partial_outage', 'major_outage')),
  primary key (incident_id, component_id)
);

create index if not exists status_incident_components_component_idx on public.status_incident_components(component_id);

create table if not exists public.status_updates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  incident_id uuid not null references public.status_incidents(id) on delete cascade,
  message text not null
);

create index if not exists status_updates_incident_created_desc_idx
  on public.status_updates(incident_id, created_at desc);

drop trigger if exists system_components_touch_updated_at on public.system_components;
create trigger system_components_touch_updated_at
before update on public.system_components
for each row execute function public.touch_updated_at();

drop trigger if exists status_incidents_touch_updated_at on public.status_incidents;
create trigger status_incidents_touch_updated_at
before update on public.status_incidents
for each row execute function public.touch_updated_at();

alter table public.system_components enable row level security;
alter table public.status_incidents enable row level security;
alter table public.status_incident_components enable row level security;
alter table public.status_updates enable row level security;

drop policy if exists system_components_public_read on public.system_components;
create policy system_components_public_read on public.system_components
for select to anon, authenticated
using (is_public = true);

drop policy if exists system_components_admin_all on public.system_components;
create policy system_components_admin_all on public.system_components
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists status_incidents_public_read on public.status_incidents;
create policy status_incidents_public_read on public.status_incidents
for select to anon, authenticated
using (is_public = true);

drop policy if exists status_incidents_admin_all on public.status_incidents;
create policy status_incidents_admin_all on public.status_incidents
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists status_incident_components_public_read on public.status_incident_components;
create policy status_incident_components_public_read on public.status_incident_components
for select to anon, authenticated
using (
  exists (
    select 1
    from public.status_incidents si
    where si.id = status_incident_components.incident_id
      and si.is_public = true
  )
  and exists (
    select 1
    from public.system_components sc
    where sc.id = status_incident_components.component_id
      and sc.is_public = true
  )
);

drop policy if exists status_incident_components_admin_all on public.status_incident_components;
create policy status_incident_components_admin_all on public.status_incident_components
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists status_updates_public_read on public.status_updates;
create policy status_updates_public_read on public.status_updates
for select to anon, authenticated
using (
  exists (
    select 1
    from public.status_incidents si
    where si.id = status_updates.incident_id
      and si.is_public = true
  )
);

drop policy if exists status_updates_admin_all on public.status_updates;
create policy status_updates_admin_all on public.status_updates
for all
using (public.is_admin())
with check (public.is_admin());

insert into public.system_components (key, name, description, is_public, sort_order)
values
  ('api', 'API', 'Public and internal API endpoints.', true, 10),
  ('dashboard', 'Dashboard', 'Business dashboard and settings surface.', true, 20),
  ('builder', 'Builder', 'Website builder and publishing flow.', true, 30),
  ('chatbot', 'Chatbot', 'Chatbot runtime and conversation handling.', true, 40),
  ('payments', 'Payments', 'Billing and subscription processing.', true, 50)
on conflict (key) do nothing;

-- =======================================
-- 2) In-app announcements
-- =======================================
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  audience text not null default 'all' check (audience in ('all', 'business')),
  business_id uuid references public.businesses(id) on delete cascade,
  emoji text not null default '📣',
  preset text not null default 'custom' check (preset in ('custom', 'feature', 'maintenance', 'tips', 'promo', 'alert')),
  title text not null,
  body text not null,
  cta_label text,
  cta_url text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_dismissible boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  constraint announcements_business_target_check
    check (
      (audience = 'all' and business_id is null)
      or (audience = 'business' and business_id is not null)
    )
);

create index if not exists announcements_status_idx on public.announcements(status);
create index if not exists announcements_starts_at_desc_idx on public.announcements(starts_at desc);
create index if not exists announcements_business_id_idx on public.announcements(business_id);
create index if not exists announcements_audience_idx on public.announcements(audience);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists announcement_reads_business_read_desc_idx
  on public.announcement_reads(business_id, read_at desc);

drop trigger if exists announcements_touch_updated_at on public.announcements;
create trigger announcements_touch_updated_at
before update on public.announcements
for each row execute function public.touch_updated_at();

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

drop policy if exists announcements_select_business on public.announcements;
create policy announcements_select_business on public.announcements
for select
using (
  auth.uid() is not null
  and status in ('published', 'scheduled')
  and starts_at <= now()
  and (ends_at is null or now() <= ends_at)
  and (
    audience = 'all'
    or (
      audience = 'business'
      and business_id is not null
      and exists (
        select 1
        from public.businesses b
        where b.id = announcements.business_id
          and coalesce(b.owner_user_id, b.owner_id) = auth.uid()
      )
    )
  )
);

drop policy if exists announcements_admin_all on public.announcements;
create policy announcements_admin_all on public.announcements
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists announcement_reads_select_business on public.announcement_reads;
create policy announcement_reads_select_business on public.announcement_reads
for select
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and exists (
    select 1
    from public.businesses b
    where b.id = announcement_reads.business_id
      and coalesce(b.owner_user_id, b.owner_id) = auth.uid()
  )
);

drop policy if exists announcement_reads_insert_business on public.announcement_reads;
create policy announcement_reads_insert_business on public.announcement_reads
for insert
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and exists (
    select 1
    from public.businesses b
    where b.id = announcement_reads.business_id
      and coalesce(b.owner_user_id, b.owner_id) = auth.uid()
  )
  and exists (
    select 1
    from public.announcements a
    where a.id = announcement_reads.announcement_id
      and a.status in ('published', 'scheduled')
      and a.starts_at <= now()
      and (a.ends_at is null or now() <= a.ends_at)
      and (
        a.audience = 'all'
        or (a.audience = 'business' and a.business_id = announcement_reads.business_id)
      )
  )
);

drop policy if exists announcement_reads_admin_all on public.announcement_reads;
create policy announcement_reads_admin_all on public.announcement_reads
for all
using (public.is_admin())
with check (public.is_admin());

-- =======================================
-- 3) Weekly health + benchmarks
-- =======================================
create table if not exists public.business_weekly_metrics (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversations_count int not null default 0,
  leads_count int not null default 0,
  bookings_count int not null default 0,
  missed_intents_count int not null default 0,
  avg_response_time_sec int not null default 0,
  error_events_count int not null default 0,
  uptime_ratio numeric(5,4) not null default 1,
  health_score int not null default 0 check (health_score >= 0 and health_score <= 100),
  computed_at timestamptz not null default now(),
  unique (business_id, week_start)
);

create index if not exists business_weekly_metrics_business_id_idx on public.business_weekly_metrics(business_id);
create index if not exists business_weekly_metrics_week_start_desc_idx on public.business_weekly_metrics(week_start desc);

create table if not exists public.industry_benchmarks_weekly (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  industry text not null,
  conversations_p50 int not null default 0,
  leads_p50 int not null default 0,
  bookings_p50 int not null default 0,
  conversion_p50 numeric(6,4) not null default 0,
  health_p50 int not null default 0,
  unique (industry, week_start)
);

create index if not exists industry_benchmarks_weekly_week_start_desc_idx
  on public.industry_benchmarks_weekly(week_start desc);

alter table public.business_weekly_metrics enable row level security;
alter table public.industry_benchmarks_weekly enable row level security;

drop policy if exists business_weekly_metrics_select_owner on public.business_weekly_metrics;
create policy business_weekly_metrics_select_owner on public.business_weekly_metrics
for select
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_weekly_metrics.business_id
      and coalesce(b.owner_user_id, b.owner_id) = auth.uid()
  )
);

drop policy if exists business_weekly_metrics_admin_all on public.business_weekly_metrics;
create policy business_weekly_metrics_admin_all on public.business_weekly_metrics
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists industry_benchmarks_weekly_admin_all on public.industry_benchmarks_weekly;
create policy industry_benchmarks_weekly_admin_all on public.industry_benchmarks_weekly
for all
using (public.is_admin())
with check (public.is_admin());

-- =======================================
-- 4) Error ingestion + grouping
-- =======================================
create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null,
  environment text not null default 'prod' check (environment in ('dev', 'staging', 'prod')),
  severity text not null default 'error' check (severity in ('info', 'warn', 'error', 'fatal')),
  fingerprint text not null,
  message text not null,
  stack text,
  route text,
  url text,
  user_agent text,
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists error_events_created_at_desc_idx on public.error_events(created_at desc);
create index if not exists error_events_fingerprint_idx on public.error_events(fingerprint);
create index if not exists error_events_business_id_idx on public.error_events(business_id);
create index if not exists error_events_severity_idx on public.error_events(severity);
create index if not exists error_events_environment_idx on public.error_events(environment);

create table if not exists public.error_groups (
  fingerprint text primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrences int not null default 1,
  status text not null default 'open' check (status in ('open', 'muted', 'resolved')),
  linked_feedback_id uuid references public.feedback_reports(id) on delete set null,
  title text not null,
  sample_message text not null,
  sample_stack text,
  sample_route text
);

create index if not exists error_groups_last_seen_desc_idx on public.error_groups(last_seen_at desc);
create index if not exists error_groups_status_idx on public.error_groups(status);
create index if not exists error_groups_linked_feedback_idx on public.error_groups(linked_feedback_id);

alter table public.error_events enable row level security;
alter table public.error_groups enable row level security;

drop policy if exists error_events_select_owner on public.error_events;
create policy error_events_select_owner on public.error_events
for select
using (
  business_id is not null
  and exists (
    select 1
    from public.businesses b
    where b.id = error_events.business_id
      and coalesce(b.owner_user_id, b.owner_id) = auth.uid()
  )
);

drop policy if exists error_events_insert_authenticated on public.error_events;
create policy error_events_insert_authenticated on public.error_events
for insert
with check (
  auth.uid() is not null
  and (user_id is null or user_id = auth.uid())
  and (
    business_id is null
    or exists (
      select 1
      from public.businesses b
      where b.id = error_events.business_id
        and coalesce(b.owner_user_id, b.owner_id) = auth.uid()
    )
  )
);

drop policy if exists error_events_admin_all on public.error_events;
create policy error_events_admin_all on public.error_events
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists error_groups_admin_all on public.error_groups;
create policy error_groups_admin_all on public.error_groups
for all
using (public.is_admin())
with check (public.is_admin());

-- =======================================
-- 5) Admin client activity feed
-- =======================================
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'business_user' check (actor_type in ('business_user', 'system', 'admin')),
  event_type text not null,
  summary text not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists activity_events_business_created_desc_idx
  on public.activity_events(business_id, created_at desc);
create index if not exists activity_events_event_type_idx
  on public.activity_events(event_type);
create index if not exists activity_events_created_desc_idx
  on public.activity_events(created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists activity_events_admin_all on public.activity_events;
create policy activity_events_admin_all on public.activity_events
for all
using (public.is_admin())
with check (public.is_admin());
