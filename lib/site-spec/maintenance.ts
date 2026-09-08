import "server-only";

import { resolvePublicMode } from "@/lib/site-spec/rollout";
import { logSiteSpecEvent } from "@/lib/site-spec/telemetry";
import type { MaintenanceSite } from "@/components/site-spec/MaintenanceSitePage";

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => any;
};

/**
 * Is this published slug currently in `maintenance`, and if so what does the
 * holding page say?
 *
 * Deliberately its own small query rather than a branch inside the main site
 * loader: maintenance has to work when the thing the loader would return is the
 * reason we are in maintenance. It reads two tables — the site row to find the
 * tenant, and canonical business/location data for the page — and it reads
 * nothing from the Site Spec at all.
 *
 * Returns `null` for any business not in maintenance, so the caller carries on
 * exactly as before.
 */
export const loadMaintenanceSite = async (
  supabase: SupabaseLike,
  slug: string
): Promise<MaintenanceSite | null> => {
  if (!slug) return null;

  const { data: site, error } = await supabase
    .from("builder_sites")
    .select("id, business_id, business_name")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  // An unreadable site row is not a reason to claim maintenance; fall through and
  // let the normal path make its own decision.
  if (error || !site?.business_id) return null;

  const businessId = site.business_id as string;
  if ((await resolvePublicMode(supabase, businessId)) !== "maintenance") return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name")
    .eq("id", businessId)
    .maybeSingle();

  const { data: locations } = await supabase
    .from("location")
    .select("address, phone, is_primary")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .limit(1);
  const location = (locations ?? [])[0] as { address?: string | null; phone?: string | null } | undefined;

  logSiteSpecEvent("PUBLIC_MODE_SERVED", { businessId, siteId: site.id, mode: "maintenance" });

  return {
    // Canonical business name, with the site row's copy as a fallback. Never a
    // heading from the Site Spec: the spec is what we are holding back.
    businessName:
      (business?.business_name as string | null) ?? (site.business_name as string | null) ?? "Our business",
    phone: location?.phone ?? null,
    address: location?.address ?? null
  };
};
