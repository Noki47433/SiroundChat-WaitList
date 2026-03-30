-- Summary: backfills lead typing and visitor aggregates for dashboard/admin views.

alter table if exists public.leads
  add column if not exists lead_type text,
  add column if not exists payload jsonb not null default '{}'::jsonb;

update public.leads
set lead_type = case
  when coalesce(conversation_id::text, '') <> '' or lower(coalesce(source, '')) = 'widget' then 'chat'
  when lower(coalesce(source, '')) = 'website_form' then 'contact_form'
  else coalesce(nullif(trim(source), ''), 'unknown')
end
where coalesce(trim(lead_type), '') = '';

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'business_metrics_daily'
  ) and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'website_analytics_events'
  ) then
    insert into public.business_metrics_daily (
      business_id,
      day,
      visitors_count
    )
    select
      business_id,
      (occurred_at at time zone 'utc')::date as day,
      count(distinct session_id) as visitors_count
    from public.website_analytics_events
    where event_type = 'page_view'
      and session_id is not null
      and business_id is not null
      and occurred_at is not null
    group by business_id, (occurred_at at time zone 'utc')::date
    on conflict (business_id, day) do update
    set visitors_count = greatest(public.business_metrics_daily.visitors_count, excluded.visitors_count);
  end if;
end $$;
