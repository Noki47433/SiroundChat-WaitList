/**
 * Assembling a renderable website from a stored Site Spec.
 *
 * One function joins the three sources the renderer needs — the published (or
 * draft) spec, canonical business data, and the site's assets — and hands back
 * a `ResolvedSite`. The public route calls this and either gets a site back or
 * gets `null`, in which case it falls through to the legacy document paths
 * exactly as before.
 */
import { loadBusiness } from "@/lib/business/load";
import { resolveSite, type ResolvedSite, type SiteAsset } from "@/lib/site-spec/resolve";
import { resolveRolloutState } from "@/lib/site-spec/rollout";
import { logSiteSpecEvent } from "@/lib/site-spec/telemetry";
import {
  loadDraftSpecBySiteId,
  loadPublishedSpecBySlug,
  loadSiteAssets
} from "@/lib/site-spec/store";

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => any;
};

/**
 * The rollout gate for the PUBLIC renderer (Stage 2.5).
 *
 * Both entry points below return `null` for a business that is not rolled out,
 * which is the same answer they already give for every site that has no spec —
 * so the caller falls through to the legacy document path with no new branch and
 * no new failure mode. That equivalence is the whole design: turning the flag
 * off is not a special mode, it is simply a business having no Site Spec as far
 * as the public route can tell, while every version row stays exactly where it
 * is. Flag off, legacy renders. Flag on again, the site comes back unchanged.
 */
const servableUnderRollout = async (
  supabase: SupabaseLike,
  businessId: string,
  siteId: string
): Promise<boolean> => {
  if ((await resolveRolloutState(supabase, businessId)) !== "off") return true;
  logSiteSpecEvent("ROLLOUT_BLOCKED", { businessId, siteId, surface: "renderer" });
  return false;
};

export type RenderableSite = {
  siteId: string;
  businessId: string;
  slug: string;
  versionId: string;
  versionNumber: number;
  site: ResolvedSite;
};

/** Business-level fields the booking-domain loader does not carry. */
const loadProfile = async (supabase: SupabaseLike, businessId: string) => {
  const { data } = await supabase
    .from("businesses")
    .select("logo_url")
    .eq("id", businessId)
    .maybeSingle();
  return {
    logoUrl: (data as { logo_url?: string | null } | null)?.logo_url ?? null
  };
};

const assemble = async (
  supabase: SupabaseLike,
  found: {
    siteId: string;
    businessId: string;
    slug: string;
    versionId: string;
    versionNumber: number;
    spec: Parameters<typeof resolveSite>[0]["spec"];
  }
): Promise<RenderableSite> => {
  const [business, assets, profile] = await Promise.all([
    loadBusiness(supabase, found.businessId),
    loadSiteAssets(supabase, found.siteId),
    loadProfile(supabase, found.businessId)
  ]);

  return {
    siteId: found.siteId,
    businessId: found.businessId,
    slug: found.slug,
    versionId: found.versionId,
    versionNumber: found.versionNumber,
    site: resolveSite({
      spec: found.spec,
      business,
      assets: assets as SiteAsset[],
      profile
    })
  };
};

/**
 * What customers are served. Returns null for every site that is not on the
 * Site Spec model, which is all of them until one is migrated.
 */
export const loadRenderablePublishedSite = async (
  supabase: SupabaseLike,
  slug: string
): Promise<RenderableSite | null> => {
  const found = await loadPublishedSpecBySlug(supabase, slug);
  if (!found) return null;
  if (!(await servableUnderRollout(supabase, found.businessId, found.siteId))) return null;
  return assemble(supabase, found);
};

/** What the owner is working on. Ownership is checked by the caller. */
export const loadRenderableDraftSite = async (
  supabase: SupabaseLike,
  siteId: string
): Promise<RenderableSite | null> => {
  const found = await loadDraftSpecBySiteId(supabase, siteId);
  if (!found) return null;
  if (!(await servableUnderRollout(supabase, found.businessId, found.siteId))) return null;
  return assemble(supabase, found);
};
