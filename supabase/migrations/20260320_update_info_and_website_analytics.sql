-- Summary: Adds reviewed chatbot update info rules and extends website analytics events for reservation conversion tracking.

create table if not exists public.chatbot_update_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  input_text text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'applied', 'discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chatbot_update_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entry_id uuid null references public.chatbot_update_entries(id) on delete set null,
  category text not null check (category in ('offer', 'closure', 'reservation_constraint', 'recommendation', 'service_notice', 'faq', 'general_notice')),
  title text not null,
  body text not null,
  keywords text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chatbot_update_entries_business_created_idx
  on public.chatbot_update_entries(business_id, created_at desc);
create index if not exists chatbot_update_rules_business_status_idx
  on public.chatbot_update_rules(business_id, approval_status, created_at desc);
create index if not exists chatbot_update_rules_business_category_idx
  on public.chatbot_update_rules(business_id, category, created_at desc);
create index if not exists chatbot_update_rules_keywords_gin_idx
  on public.chatbot_update_rules using gin (keywords);

alter table public.chatbot_update_entries enable row level security;
alter table public.chatbot_update_rules enable row level security;

drop policy if exists chatbot_update_entries_owner_all on public.chatbot_update_entries;
create policy chatbot_update_entries_owner_all on public.chatbot_update_entries
for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

drop policy if exists chatbot_update_rules_owner_all on public.chatbot_update_rules;
create policy chatbot_update_rules_owner_all on public.chatbot_update_rules
for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

drop trigger if exists chatbot_update_entries_touch_updated_at on public.chatbot_update_entries;
create trigger chatbot_update_entries_touch_updated_at
before update on public.chatbot_update_entries
for each row execute function public.touch_updated_at();

drop trigger if exists chatbot_update_rules_touch_updated_at on public.chatbot_update_rules;
create trigger chatbot_update_rules_touch_updated_at
before update on public.chatbot_update_rules
for each row execute function public.touch_updated_at();

do $$
declare
  constraint_name text;
begin
  alter table public.website_analytics_events
    drop constraint if exists website_analytics_events_event_type_check;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.website_analytics_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%event_type%'
  loop
    execute format(
      'alter table public.website_analytics_events drop constraint if exists %I',
      constraint_name
    );
  end loop;

  alter table public.website_analytics_events
    add constraint website_analytics_events_event_type_check
    check (
      event_type in (
        'page_view',
        'cta_click',
        'lead_submitted',
        'chat_open',
        'chat_started',
        'reservation_started',
        'reservation_completed'
      )
    );
end $$;
