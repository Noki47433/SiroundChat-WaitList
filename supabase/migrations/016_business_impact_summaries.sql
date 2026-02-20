-- Summary: Store computed impact summaries for dashboard popups.

create table if not exists business_impact_summaries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  period text not null check (period in ('weekly', 'monthly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  shown_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists business_impact_summaries_unique
  on business_impact_summaries (business_id, period, period_start);

create index if not exists business_impact_summaries_business_id
  on business_impact_summaries (business_id);

alter table business_impact_summaries enable row level security;

create policy if not exists "impact_summaries_select_owner" on business_impact_summaries
for select using (
  exists (
    select 1 from businesses b
    where b.id = business_impact_summaries.business_id and b.owner_id = auth.uid()
  )
);

create policy if not exists "impact_summaries_update_owner" on business_impact_summaries
for update using (
  exists (
    select 1 from businesses b
    where b.id = business_impact_summaries.business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from businesses b
    where b.id = business_impact_summaries.business_id and b.owner_id = auth.uid()
  )
);
