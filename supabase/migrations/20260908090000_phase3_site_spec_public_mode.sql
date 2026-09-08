-- ============================================================================
-- Phase 3 · Stage 3E — public serving mode
--
-- WHY
--   Until now one column did two jobs. `business_site_spec_rollout.state`
--   answered "may this owner use the new builder?" and, by the same value,
--   "what do visitors to this website see?". For the canary that conflation was
--   invisible, because the answer to both was yes. It stopped being invisible
--   the moment we drilled a rollback: turning the flag off took Siround's public
--   website to a 404, because a Site-Spec-only business has no legacy document
--   to fall back to. The rollback lever and the "delete the customer's website"
--   lever were the same switch.
--
--   That is not an acceptable thing to hand five businesses, let alone twenty.
--   An operator must be able to withdraw the editor from a business without
--   taking its website off the internet, and must be able to put a website into
--   a holding state without destroying anything.
--
-- WHAT
--   One additive column. `state` keeps its meaning — owner/editor access — and
--   `public_mode` becomes the separate question of what the public is served:
--
--     site_spec        the published Site Spec version
--     legacy_fallback  the existing legacy document/template (today's flag-off)
--     maintenance      a minimal safe page built from canonical Business data
--
-- SAFETY
--   * Additive: one column with a default, one new function. No table rewritten,
--     no row deleted, no existing column's meaning changed.
--   * Behaviour-preserving: the default is `legacy_fallback`, which is exactly
--     what a business with no row already gets, and the one enabled business is
--     explicitly moved to `site_spec` so nothing it serves changes.
--   * Reversible: `20260908090000_phase3_site_spec_public_mode_down.sql`.
-- ============================================================================

alter table public.business_site_spec_rollout
  add column if not exists public_mode text not null default 'legacy_fallback';

do $$
begin
  alter table public.business_site_spec_rollout
    add constraint business_site_spec_rollout_public_mode_check
    check (public_mode in ('site_spec', 'legacy_fallback', 'maintenance'));
exception
  when duplicate_object then null;
end
$$;

comment on column public.business_site_spec_rollout.public_mode is
  'Phase 3 Stage 3E: what the PUBLIC is served, independent of `state`, which governs '
  'owner/editor access. site_spec = the published Site Spec; legacy_fallback = the legacy '
  'document (the historic flag-off behaviour); maintenance = a minimal safe page from '
  'canonical Business data, served 200. Withdrawing the editor must never take a website down.';

-- Preserve today's behaviour exactly. Any business currently being served by the
-- Site Spec renderer keeps being served by it; everything else is unchanged
-- because `legacy_fallback` is what it already had.
update public.business_site_spec_rollout
   set public_mode = 'site_spec'
 where state <> 'off'
   and public_mode = 'legacy_fallback';

-- The read the public renderer makes on every request. SECURITY DEFINER with a
-- pinned search_path, so it can answer for unauthenticated visitors, and it
-- returns one word — never the row, never the operator note.
--
-- A business with no row resolves to `legacy_fallback`, which is the same
-- fail-closed answer `site_spec_rollout_state` gives today: unknown business,
-- serve the old thing.
create or replace function public.site_spec_public_mode(target_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public_mode from public.business_site_spec_rollout where business_id = target_business_id),
    'legacy_fallback'
  );
$$;

revoke all on function public.site_spec_public_mode(uuid) from public;
grant execute on function public.site_spec_public_mode(uuid) to authenticated, anon, service_role;

create index if not exists business_site_spec_rollout_public_mode_idx
  on public.business_site_spec_rollout(public_mode)
  where public_mode <> 'legacy_fallback';
