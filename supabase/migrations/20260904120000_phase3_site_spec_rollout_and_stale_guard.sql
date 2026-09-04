-- ============================================================================
-- Phase 3 · Client Website — Stage 2.5 production readiness
-- ============================================================================
-- Source of truth: audit-output/phase-3/PHASE_3_CLIENT_WEBSITE_STAGE_2_5_PRODUCTION_READINESS_REPORT.md
--
-- NOT APPLIED TO PRODUCTION BY THIS MISSION. Stage 2.5 is a readiness mission;
-- it writes the migration and proves it against the local stack. Applying it is
-- step 2 of the deploy runbook and needs separate approval.
--
-- This migration closes two readiness defects found in Stage 2.5.
--
-- ── 1 · A server-authoritative per-business rollout flag (D8) ───────────────
--
-- `website_builder` is a BILLING entitlement — three of the four plans grant it.
-- It says "this business has paid for a website builder", which is exactly the
-- wrong question for a controlled rollout: it is already true for most paying
-- businesses, and turning it off to stage a rollout would take their existing
-- legacy builder away too.
--
-- So rollout needs its own axis, and it is modelled on the mechanism Phase 2
-- already proved for booking cutover (`business_booking_migration`): one row per
-- business, a small closed set of states, default OFF, and legal transitions
-- enforced by a trigger rather than by the caller remembering to be careful.
--
--   off      — the business keeps the legacy builder. Site Spec routes 404 and
--              the public renderer ignores any Site Spec that exists.
--   canary   — the owner can generate, edit, preview and publish. This is the
--              first-business state.
--   enabled  — identical capability to canary; a separate name so "how many
--              businesses are past the canary" is answerable in one query.
--
-- Turning the flag back to `off` is ALWAYS legal from any state and deletes
-- nothing: versions, drafts and the published pointer all survive, and the
-- public route simply falls back to the legacy document path. That is the
-- flag-off rollback in the runbook.
--
-- ── 2 · An atomic stale-write guard on version creation (D9) ────────────────
--
-- Stage 2 appended a version from whatever draft the request happened to read.
-- Two owners (or two tabs) editing the same site both succeeded, and the second
-- silently superseded the first — the mission calls this out explicitly: silent
-- last-write-wins is not acceptable for AI edits, because an accepted change can
-- disappear without anyone being told.
--
-- The check has to live HERE rather than in the application, because the
-- application's read of the draft and its write of the next version are two
-- round trips with a gap between them. `builder_site_create_version` already
-- takes `for update` on the site row; asserting the caller's expected parent
-- inside that lock makes the whole compare-and-append atomic.
--
-- `p_expected_parent` is optional. Null means "I am not making a claim about
-- what I edited" — used by generation of a first draft and by restore, where the
-- request is not derived from a specific prior spec.
--
-- SAFETY
--   * Additive: one new table, one new function signature, no data rewritten.
--   * The function is dropped and recreated because Postgres cannot add a
--     parameter to an existing function with CREATE OR REPLACE.
--   * `builder_site_restore_version` is recreated because it calls it.
-- ============================================================================

-- ── 1 · rollout flag ────────────────────────────────────────────────────────

create table if not exists public.business_site_spec_rollout (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  state text not null default 'off'
    check (state in ('off', 'canary', 'enabled')),
  -- Free-text operator note: which canary this is, who approved it, when.
  note text,
  enabled_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.business_site_spec_rollout is
  'Phase 3 Stage 2.5: server-authoritative per-business Site Spec rollout flag. Default off. '
  'A business with no row is OFF. Turning a business off preserves every Site Spec version '
  'and only changes which renderer the public route uses.';

create index if not exists business_site_spec_rollout_state_idx
  on public.business_site_spec_rollout(state)
  where state <> 'off';

alter table public.business_site_spec_rollout enable row level security;

-- The owner may SEE whether their business is enabled — the dashboard needs it
-- to decide which builder to show. Nobody but an admin/service role may CHANGE
-- it: a rollout flag an owner can flip is not a rollout flag.
drop policy if exists business_site_spec_rollout_select_owner on public.business_site_spec_rollout;
create policy business_site_spec_rollout_select_owner on public.business_site_spec_rollout
  for select using (public.is_business_owner(business_id));

-- Deliberately no INSERT / UPDATE / DELETE policy for `authenticated`.

create or replace function public.set_business_site_spec_rollout_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.state = 'off' then
    new.enabled_at := null;
  elsif tg_op = 'INSERT' or old.state = 'off' then
    -- First transition out of off. Re-enabling later keeps the original stamp.
    new.enabled_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists business_site_spec_rollout_touch on public.business_site_spec_rollout;
create trigger business_site_spec_rollout_touch
before insert or update on public.business_site_spec_rollout
for each row execute function public.set_business_site_spec_rollout_updated_at();

-- The read the application makes on every Site Spec request. SECURITY DEFINER
-- with a pinned search_path so it can answer for the public (unauthenticated)
-- renderer too, and it returns a single boolean — never the note or the row.
create or replace function public.site_spec_rollout_state(target_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select state from public.business_site_spec_rollout where business_id = target_business_id),
    'off'
  );
$$;

revoke all on function public.site_spec_rollout_state(uuid) from public;
grant execute on function public.site_spec_rollout_state(uuid) to authenticated, anon, service_role;

-- ── 2 · atomic stale-write guard ────────────────────────────────────────────

-- Cannot CREATE OR REPLACE across a changed parameter list.
drop function if exists public.builder_site_create_version(uuid, jsonb, text, text, uuid);

create or replace function public.builder_site_create_version(
  p_site_id uuid,
  p_spec jsonb,
  p_source text default 'edit',
  p_label text default null,
  p_restored_from uuid default null,
  -- The draft version the caller believes it edited. Null = no claim.
  p_expected_parent uuid default null
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

  v_parent := v_site.draft_version_id;

  -- Compare-and-append, inside the row lock the allocation already holds. A
  -- concurrent edit that landed between the caller's read and this call moved
  -- draft_version_id, so the claim no longer matches and this request is
  -- refused rather than silently overwriting the change that got there first.
  --
  -- SQLSTATE note, learned the hard way in Stage 2.5: do NOT use
  -- `serialization_failure` (40001) here. PostgREST treats class-40 as a
  -- transient transaction failure and retries the request, so an ordinary
  -- editing conflict surfaced as a 504 gateway timeout after several seconds
  -- instead of an immediate, honest answer. `PT409` is PostgREST's explicit
  -- "respond with this HTTP status" convention, and 409 Conflict is precisely
  -- what this is: a precondition the client stated no longer holds.
  if p_expected_parent is not null and v_parent is distinct from p_expected_parent then
    raise exception 'site % draft moved: expected % but found %',
      p_site_id, p_expected_parent, v_parent
      using errcode = 'PT409';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next
    from public.builder_site_versions
   where site_id = p_site_id;

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

-- Recreated only because its callee's signature changed; behaviour is unchanged.
-- Restore makes no parent claim: it is a deterministic copy-forward of a version
-- the caller named explicitly, not an edit of the current draft.
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
    v_source.id,
    null
  );
end;
$$;

grant execute on function public.builder_site_create_version(uuid, jsonb, text, text, uuid, uuid) to authenticated;
grant execute on function public.builder_site_restore_version(uuid, uuid) to authenticated;

-- The trigger function needs no direct grant. A function returning `trigger`
-- cannot be reached through PostgREST RPC, so this is defence in depth rather
-- than a fix — and verified: revoking EXECUTE does not stop the trigger firing.
revoke execute on function public.set_business_site_spec_rollout_updated_at() from anon, authenticated, public;
