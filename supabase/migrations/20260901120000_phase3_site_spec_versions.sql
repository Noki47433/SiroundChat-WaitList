-- ============================================================================
-- Phase 3 · Client Website — Site Spec versioning, draft/published separation
-- ============================================================================
-- Source of truth: audit-output/phase-3/PHASE_3_CLIENT_WEBSITE_AUDIT.md
--                  audit-output/phase-3/PHASE_3_CLIENT_WEBSITE_RECOMMENDATION.md (§5)
--
-- WHY THIS EXISTS
-- ---------------
-- The audit's root cause #2: a website had exactly ONE state. `builder_sites`
-- carried a single `site_document` column that was simultaneously the draft, the
-- preview and the published page, and `app/s/[slug]` read the same row every AI
-- edit wrote. That meant:
--
--   * every edit went live the instant it was made,
--   * there was no way to experiment and back out,
--   * `status = 'published'` was a flag on mutable content, not a state
--     transition — "publish" promoted nothing, because there was nothing to
--     promote,
--   * and there was no previous state to restore, so Undo could only be
--     approximated by asking a model to reverse itself.
--
-- The recommendation's build order is renderer contract -> versioning -> edits,
-- precisely so that conversational editing never lands on mutable live content.
-- This migration is the versioning step.
--
-- WHAT THIS MIGRATION DOES
--   1. Adds `builder_site_versions` — an append-only history of validated Site
--      Specs. A version is immutable once written: nothing updates `spec`.
--   2. Adds `draft_version_id` / `published_version_id` pointers to
--      `builder_sites`, plus `spec_published_at`.
--   3. Adds `builder_site_create_version()` — allocates the next version number
--      under a row lock and repoints the draft, atomically.
--   4. Adds `builder_site_publish()` / `builder_site_unpublish()` — publishing
--      is a pointer move onto an existing version, never a content write.
--   5. Adds a trigger asserting both pointers reference versions OF THIS SITE.
--
-- WHAT THIS MIGRATION DOES NOT DO
--   * It does not touch `site_document`, `status`, or any legacy column. Every
--     existing site keeps rendering exactly as it does today; a site is on the
--     new model only once it has a `published_version_id`.
--   * It does not migrate any existing site. There is no automatic conversion
--     from a legacy document to a Site Spec, and Stage 1 deliberately adds none.
--   * It does not delete or disable the old builder.
--
-- SAFETY
--   * Additive only: new table, new nullable columns, new functions.
--   * RLS mirrors the existing `builder_sites` model — `is_business_owner()`.
--   * Spec validation lives in the application (`validateSiteSpec`). The database
--     enforces shape and ownership; it does not re-implement the schema.
-- ============================================================================

-- ── 1 · version history ─────────────────────────────────────────────────────

create table if not exists public.builder_site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.builder_sites(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- Monotonic per site, allocated under a lock in builder_site_create_version().
  version_number integer not null,
  -- A validated Site Spec. Immutable: no code path updates this column.
  spec jsonb not null,
  -- How this version came to exist. 'restore' records an Undo.
  source text not null default 'manual'
    check (source in ('generated', 'edit', 'restore', 'import', 'manual')),
  label text,
  -- The version this one was produced from, so history reads as a chain.
  parent_version_id uuid references public.builder_site_versions(id) on delete set null,
  -- For source = 'restore': the older version whose spec was copied forward.
  restored_from_version_id uuid references public.builder_site_versions(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint builder_site_versions_number_positive check (version_number > 0),
  constraint builder_site_versions_site_number_unique unique (site_id, version_number)
);

create index if not exists builder_site_versions_site_created_idx
  on public.builder_site_versions(site_id, version_number desc);
create index if not exists builder_site_versions_business_idx
  on public.builder_site_versions(business_id);

alter table public.builder_site_versions enable row level security;

drop policy if exists builder_site_versions_select_owner on public.builder_site_versions;
create policy builder_site_versions_select_owner on public.builder_site_versions
  for select using (public.is_business_owner(business_id));

drop policy if exists builder_site_versions_insert_owner on public.builder_site_versions;
create policy builder_site_versions_insert_owner on public.builder_site_versions
  for insert with check (public.is_business_owner(business_id));

-- No UPDATE policy, by design: a version is immutable once written.
drop policy if exists builder_site_versions_update_owner on public.builder_site_versions;

drop policy if exists builder_site_versions_delete_owner on public.builder_site_versions;
create policy builder_site_versions_delete_owner on public.builder_site_versions
  for delete using (public.is_business_owner(business_id));

-- ── 2 · pointers on the site ────────────────────────────────────────────────

alter table if exists public.builder_sites
  add column if not exists draft_version_id uuid,
  add column if not exists published_version_id uuid,
  add column if not exists spec_published_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'builder_sites_draft_version_fkey'
  ) then
    alter table public.builder_sites
      add constraint builder_sites_draft_version_fkey
      foreign key (draft_version_id)
      references public.builder_site_versions(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'builder_sites_published_version_fkey'
  ) then
    alter table public.builder_sites
      add constraint builder_sites_published_version_fkey
      foreign key (published_version_id)
      references public.builder_site_versions(id) on delete set null;
  end if;
end $$;

create index if not exists builder_sites_published_version_idx
  on public.builder_sites(published_version_id)
  where published_version_id is not null;

-- A pointer must reference a version OF THIS SITE. A plain foreign key cannot
-- say that, so it is asserted here rather than trusted from the application.
create or replace function public.builder_sites_validate_version_pointers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.draft_version_id is not null and not exists (
    select 1 from public.builder_site_versions v
    where v.id = new.draft_version_id and v.site_id = new.id
  ) then
    raise exception 'draft_version_id % does not belong to site %', new.draft_version_id, new.id
      using errcode = 'check_violation';
  end if;

  if new.published_version_id is not null and not exists (
    select 1 from public.builder_site_versions v
    where v.id = new.published_version_id and v.site_id = new.id
  ) then
    raise exception 'published_version_id % does not belong to site %', new.published_version_id, new.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists builder_sites_validate_version_pointers_trg on public.builder_sites;
create trigger builder_sites_validate_version_pointers_trg
before insert or update of draft_version_id, published_version_id on public.builder_sites
for each row execute function public.builder_sites_validate_version_pointers();

-- ── 3 · create a version and move the draft onto it ─────────────────────────
--
-- One statement, one transaction: allocate the next number under a lock on the
-- site row, insert the immutable version, and repoint the draft. Two concurrent
-- edits therefore produce two versions, never a lost one or a duplicate number.

create or replace function public.builder_site_create_version(
  p_site_id uuid,
  p_spec jsonb,
  p_source text default 'edit',
  p_label text default null,
  p_restored_from uuid default null
)
returns public.builder_site_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_site public.builder_sites%rowtype;
  v_next integer;
  v_parent uuid;
  v_row public.builder_site_versions%rowtype;
begin
  select * into v_site from public.builder_sites where id = p_site_id for update;
  if not found then
    raise exception 'site % not found', p_site_id using errcode = 'no_data_found';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next
    from public.builder_site_versions
   where site_id = p_site_id;

  v_parent := v_site.draft_version_id;

  insert into public.builder_site_versions (
    site_id, business_id, version_number, spec, source, label,
    parent_version_id, restored_from_version_id, created_by
  ) values (
    p_site_id, v_site.business_id, v_next, p_spec, p_source, p_label,
    v_parent, p_restored_from, auth.uid()
  )
  returning * into v_row;

  update public.builder_sites
     set draft_version_id = v_row.id,
         updated_at = now()
   where id = p_site_id;

  return v_row;
end;
$$;

-- ── 4 · publish / unpublish ─────────────────────────────────────────────────
--
-- Publishing promotes an EXISTING version. It writes no content, so it cannot
-- half-apply, and the live site is unaffected until the pointer moves.

create or replace function public.builder_site_publish(
  p_site_id uuid,
  p_version_id uuid default null
)
returns public.builder_sites
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_site public.builder_sites%rowtype;
  v_target uuid;
begin
  select * into v_site from public.builder_sites where id = p_site_id for update;
  if not found then
    raise exception 'site % not found', p_site_id using errcode = 'no_data_found';
  end if;

  v_target := coalesce(p_version_id, v_site.draft_version_id);
  if v_target is null then
    raise exception 'site % has no draft version to publish', p_site_id
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.builder_site_versions v
    where v.id = v_target and v.site_id = p_site_id
  ) then
    raise exception 'version % does not belong to site %', v_target, p_site_id
      using errcode = 'check_violation';
  end if;

  update public.builder_sites
     set published_version_id = v_target,
         spec_published_at = now(),
         status = 'published',
         updated_at = now()
   where id = p_site_id
  returning * into v_site;

  return v_site;
end;
$$;

create or replace function public.builder_site_unpublish(p_site_id uuid)
returns public.builder_sites
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_site public.builder_sites%rowtype;
begin
  update public.builder_sites
     set published_version_id = null,
         spec_published_at = null,
         status = 'draft',
         updated_at = now()
   where id = p_site_id
  returning * into v_site;

  if not found then
    raise exception 'site % not found', p_site_id using errcode = 'no_data_found';
  end if;

  return v_site;
end;
$$;

-- ── 5 · restore ─────────────────────────────────────────────────────────────
--
-- Undo copies an older version's spec FORWARD as a new version. History is
-- append-only, so undoing is itself recoverable, and no model is ever asked to
-- reverse an edit it made.

create or replace function public.builder_site_restore_version(
  p_site_id uuid,
  p_version_id uuid
)
returns public.builder_site_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source public.builder_site_versions%rowtype;
begin
  select * into v_source
    from public.builder_site_versions
   where id = p_version_id and site_id = p_site_id;

  if not found then
    raise exception 'version % does not belong to site %', p_version_id, p_site_id
      using errcode = 'no_data_found';
  end if;

  return public.builder_site_create_version(
    p_site_id,
    v_source.spec,
    'restore',
    coalesce(v_source.label, 'Restored version ' || v_source.version_number),
    v_source.id
  );
end;
$$;

-- Same reasoning as the metrics trigger functions in 20260813124000: a function
-- returning `trigger` is unreachable through PostgREST RPC, so the default
-- anon/authenticated grant is pointless surface. Revoking it does not stop the
-- trigger firing.
revoke execute on function public.builder_sites_validate_version_pointers() from anon, authenticated, public;

grant execute on function public.builder_site_create_version(uuid, jsonb, text, text, uuid) to authenticated;
grant execute on function public.builder_site_publish(uuid, uuid) to authenticated;
grant execute on function public.builder_site_unpublish(uuid) to authenticated;
grant execute on function public.builder_site_restore_version(uuid, uuid) to authenticated;
