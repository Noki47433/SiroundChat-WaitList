-- Summary: Adds notifications, badges, and notification settings/FAQ storage with ownership policies.

create extension if not exists pgcrypto;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  body text not null,
  severity text not null check (severity in ('info', 'success', 'warning', 'critical', 'celebration')),
  category text not null check (category in ('revenue', 'growth', 'ops', 'quality', 'product', 'insight')),
  cta_label text null,
  cta_url text null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  archived_at timestamptz null
);
create index if not exists notifications_business_created_idx on notifications(business_id, created_at desc);
create index if not exists notifications_business_category_created_idx on notifications(business_id, category, created_at desc);
create index if not exists notifications_unread_idx on notifications(business_id) where read_at is null and archived_at is null;
create unique index if not exists notifications_dedupe_idx
  on notifications(business_id, (data->>'source_type'), (data->>'source_id'))
  where (data ? 'source_type') and (data ? 'source_id');

create table if not exists badge_definitions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text not null,
  icon text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  created_at timestamptz not null default now(),
  criteria jsonb not null default '{}'::jsonb
);

create table if not exists business_badges (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  badge_id uuid not null references badge_definitions(id) on delete cascade,
  earned_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  unique (business_id, badge_id)
);
create index if not exists business_badges_business_earned_idx on business_badges(business_id, earned_at desc);

create table if not exists business_notification_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  deliver_in_app boolean not null default true,
  deliver_push boolean not null default true,
  min_severity_to_toast text not null default 'success'
    check (min_severity_to_toast in ('info', 'success', 'warning', 'critical', 'celebration')),
  currency text not null default 'EUR',
  avg_order_value numeric null,
  close_rate numeric null,
  updated_at timestamptz not null default now()
);

create table if not exists business_faq_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_faq_items_business_created_idx on business_faq_items(business_id, created_at desc);

create or replace function set_business_notification_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists business_notification_settings_set_updated_at on business_notification_settings;
create trigger business_notification_settings_set_updated_at
before update on business_notification_settings
for each row execute function set_business_notification_settings_updated_at();

create or replace function set_business_faq_items_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists business_faq_items_set_updated_at on business_faq_items;
create trigger business_faq_items_set_updated_at
before update on business_faq_items
for each row execute function set_business_faq_items_updated_at();

alter table notifications enable row level security;
create policy if not exists "notifications_select_owner" on notifications
for select using (
  exists (
    select 1 from businesses b
    where b.id = notifications.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists "notifications_update_owner" on notifications
for update using (
  exists (
    select 1 from businesses b
    where b.id = notifications.business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from businesses b
    where b.id = notifications.business_id and b.owner_id = auth.uid()
  )
);
revoke update on notifications from anon;
revoke update on notifications from authenticated;
grant update (read_at, archived_at) on notifications to authenticated;

alter table badge_definitions enable row level security;
create policy if not exists "badge_definitions_select_authenticated" on badge_definitions
for select to authenticated using (true);

alter table business_badges enable row level security;
create policy if not exists "business_badges_select_owner" on business_badges
for select using (
  exists (
    select 1 from businesses b
    where b.id = business_badges.business_id and b.owner_id = auth.uid()
  )
);

alter table business_notification_settings enable row level security;
create policy if not exists "business_notification_settings_select_owner" on business_notification_settings
for select using (
  exists (
    select 1 from businesses b
    where b.id = business_notification_settings.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists "business_notification_settings_update_owner" on business_notification_settings
for update using (
  exists (
    select 1 from businesses b
    where b.id = business_notification_settings.business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from businesses b
    where b.id = business_notification_settings.business_id and b.owner_id = auth.uid()
  )
);

alter table business_faq_items enable row level security;
create policy if not exists "business_faq_items_select_owner" on business_faq_items
for select using (
  exists (
    select 1 from businesses b
    where b.id = business_faq_items.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists "business_faq_items_insert_owner" on business_faq_items
for insert with check (
  exists (
    select 1 from businesses b
    where b.id = business_faq_items.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists "business_faq_items_update_owner" on business_faq_items
for update using (
  exists (
    select 1 from businesses b
    where b.id = business_faq_items.business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from businesses b
    where b.id = business_faq_items.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists "business_faq_items_delete_owner" on business_faq_items
for delete using (
  exists (
    select 1 from businesses b
    where b.id = business_faq_items.business_id and b.owner_id = auth.uid()
  )
);

insert into badge_definitions (key, name, description, icon, rarity, criteria)
values
  ('first_conversation', 'First Conversation', 'You started your first conversation.', '💬', 'common', '{"type":"conversation_count","threshold":1}'),
  ('first_lead', 'First Lead', 'You captured your first lead.', '✅', 'common', '{"type":"lead_count","threshold":1}'),
  ('first_contact_intent', 'Contact Intent', 'A visitor asked how to reach you.', '📞', 'rare', '{"type":"contact_intent","threshold":1}'),
  ('ten_leads_month', 'Lead Streak', 'You captured 10 leads in a month.', '📈', 'epic', '{"type":"lead_count_month","threshold":10}'),
  ('fifty_conversations', 'Conversation 50', 'You reached 50 conversations.', '🗣️', 'rare', '{"type":"conversation_count","threshold":50}'),
  ('hundred_conversations', 'Conversation 100', 'You reached 100 conversations.', '🏁', 'epic', '{"type":"conversation_count","threshold":100}'),
  ('faq_fixers', 'FAQ Fixers', 'Fallbacks dropped week over week.', '🛠️', 'legendary', '{"type":"fallback_drop","threshold":"week_over_week"}'),
  ('fast_responder', 'Fast Responder', 'You meet the response-time target.', '⚡', 'rare', '{"type":"response_time","threshold":"target"}')
on conflict (key) do nothing;
