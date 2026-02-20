-- Summary: Adds business feedback reports plus admin triage workflow, internal audit comments, triggers, and RLS policies.

create extension if not exists pgcrypto;

create table if not exists feedback_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  category text not null check (category in ('bug', 'feature_request', 'ux_issue', 'billing_issue', 'other')),
  importance text not null check (importance in ('low', 'medium', 'high', 'critical')),
  title text not null,
  description text not null,
  steps_to_reproduce text,
  expected_behavior text,
  actual_behavior text,
  url text,
  browser_info text,
  attachments jsonb not null default '[]'::jsonb,
  business_id uuid references businesses(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  contact_email text,
  admin_notes text,
  resolved_at timestamptz,
  resolution_summary text,
  triage_status text not null default 'new' check (
    triage_status in (
      'new',
      'needs_repro',
      'acknowledged',
      'planned',
      'in_progress',
      'resolved',
      'closed',
      'wontfix',
      'duplicate'
    )
  ),
  priority text not null default 'p3' check (priority in ('p0', 'p1', 'p2', 'p3')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  first_response_at timestamptz,
  last_activity_at timestamptz not null default now(),
  duplicate_of_id uuid references feedback_reports(id) on delete set null,
  tags text[] not null default '{}'::text[],
  internal_comments_count int not null default 0,
  repro_checklist jsonb not null default '{}'::jsonb,
  constraint feedback_reports_duplicate_self_check check (duplicate_of_id is null or duplicate_of_id <> id)
);

create index if not exists feedback_reports_created_at_desc_idx on feedback_reports(created_at desc);
create index if not exists feedback_reports_status_idx on feedback_reports(status);
create index if not exists feedback_reports_business_id_idx on feedback_reports(business_id);
create index if not exists feedback_reports_importance_idx on feedback_reports(importance);
create index if not exists feedback_reports_triage_status_idx on feedback_reports(triage_status);
create index if not exists feedback_reports_priority_idx on feedback_reports(priority);
create index if not exists feedback_reports_assigned_to_idx on feedback_reports(assigned_to);
create index if not exists feedback_reports_due_at_idx on feedback_reports(due_at);
create index if not exists feedback_reports_last_activity_desc_idx on feedback_reports(last_activity_at desc);
create index if not exists feedback_reports_tags_gin_idx on feedback_reports using gin(tags);

create table if not exists feedback_internal_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  report_id uuid not null references feedback_reports(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'comment' check (
    type in ('comment', 'status_change', 'assignment_change', 'tag_change', 'priority_change', 'link_change')
  ),
  message text not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists feedback_internal_comments_report_created_desc_idx
  on feedback_internal_comments(report_id, created_at desc);
create index if not exists feedback_internal_comments_admin_user_idx
  on feedback_internal_comments(admin_user_id);

create or replace function public.feedback_reports_before_update()
returns trigger
language plpgsql
as $$
begin
  if old.triage_status = 'new'
    and new.triage_status is distinct from old.triage_status
    and coalesce(new.triage_status, 'new') <> 'new'
    and old.first_response_at is null
    and new.first_response_at is null
  then
    new.first_response_at = now();
  end if;

  if public.is_admin() then
    new.last_activity_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists feedback_reports_before_update on feedback_reports;
create trigger feedback_reports_before_update
before update on feedback_reports
for each row execute function public.feedback_reports_before_update();

drop trigger if exists feedback_reports_touch_updated_at on feedback_reports;
create trigger feedback_reports_touch_updated_at
before update on feedback_reports
for each row execute function public.touch_updated_at();

create or replace function public.feedback_internal_comments_after_insert()
returns trigger
language plpgsql
as $$
begin
  update feedback_reports
  set internal_comments_count = coalesce(internal_comments_count, 0) + 1
  where id = new.report_id;

  return new;
end;
$$;

drop trigger if exists feedback_internal_comments_after_insert on feedback_internal_comments;
create trigger feedback_internal_comments_after_insert
after insert on feedback_internal_comments
for each row execute function public.feedback_internal_comments_after_insert();

alter table feedback_reports enable row level security;
alter table feedback_internal_comments enable row level security;

drop policy if exists feedback_reports_insert_business on feedback_reports;
create policy feedback_reports_insert_business on feedback_reports
for insert with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and (
    business_id is null
    or exists (
      select 1
      from businesses b
      where b.id = feedback_reports.business_id
        and coalesce(b.owner_user_id, b.owner_id) = auth.uid()
    )
  )
);

drop policy if exists feedback_reports_select_business on feedback_reports;
create policy feedback_reports_select_business on feedback_reports
for select using (
  auth.uid() is not null
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from businesses b
      where b.id = feedback_reports.business_id
        and coalesce(b.owner_user_id, b.owner_id) = auth.uid()
    )
  )
);

drop policy if exists feedback_reports_select_admin on feedback_reports;
create policy feedback_reports_select_admin on feedback_reports
for select using (public.is_admin());

drop policy if exists feedback_reports_update_admin on feedback_reports;
create policy feedback_reports_update_admin on feedback_reports
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists feedback_reports_delete_admin on feedback_reports;
create policy feedback_reports_delete_admin on feedback_reports
for delete using (public.is_admin());

drop policy if exists feedback_internal_comments_select_admin on feedback_internal_comments;
create policy feedback_internal_comments_select_admin on feedback_internal_comments
for select using (public.is_admin());

drop policy if exists feedback_internal_comments_insert_admin on feedback_internal_comments;
create policy feedback_internal_comments_insert_admin on feedback_internal_comments
for insert with check (public.is_admin());
