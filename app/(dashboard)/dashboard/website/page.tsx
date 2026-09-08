import { redirect } from "next/navigation";

import { WebsiteStudioClient } from "@/components/site-spec/studio/WebsiteStudioClient";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { resolvePublicMode, resolveRolloutState } from "@/lib/site-spec/rollout";

export const dynamic = "force-dynamic";

/**
 * Phase 3 · Stage 2 — the AI website designer.
 *
 * This is the approved V2 interaction, wired to the Stage 1 pipeline: one short
 * request, up to three clarifications, then a conversation on the left and the
 * website itself on the right, for the life of the site.
 *
 * It is deliberately NOT a settings panel. The Site Spec has many fields; that
 * is an internal contract, not a reason to put dozens of controls in front of an
 * owner. Everything is reachable by asking for it.
 *
 * The legacy builder at `/dashboard/builder` is untouched and still serves every
 * site that has not been switched over.
 */
export default async function WebsitePage() {
  const access = await getEntitlementAccess("website_builder");
  if (!access.allowed) {
    return (
      <div className="sc-dash mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 lg:px-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--d-faint)]">Your website</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--d-ink)]">Website</h2>
        </div>
        <div className="mt-6">
          <UpgradeOverlay
            entitlementKey="website_builder"
            title="Unlock Website"
            description="Describe the site you want in a sentence. Your services, team, hours and location are already there."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="milky h-56" />
              <div className="milky h-56" />
              <div className="milky h-56" />
            </div>
          </UpgradeOverlay>
        </div>
      </div>
    );
  }

  const { context, response } = await requireBusinessUser({ entitlement: "website_builder" });
  if (response) redirect("/dashboard");

  // Rollout, not entitlement. `website_builder` says this business pays for a
  // website builder; the flag says whether this business is on the NEW one yet.
  // A business that is not gets sent to the builder it already has — this page
  // is only the visible half of the gate, and the routes enforce it too, so
  // reaching the studio by URL still yields nothing.
  if ((await resolveRolloutState(context.supabase, context.businessId)) === "off") {
    redirect("/dashboard/builder");
  }

  // The business's own site. Never taken from the URL.
  const { data: site } = await context.supabase
    .from("builder_sites")
    .select("id, slug")
    .eq("business_id", context.businessId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!site) {
    return (
      <div className="sc-dash mx-auto w-full max-w-[900px] px-4 py-16 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--d-faint)]">Your website</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--d-ink)]">Website</h2>
        <p className="mt-3 text-sm text-[color:var(--d-muted)]">
          There is no website set up for this business yet.
        </p>
      </div>
    );
  }

  // Two different switches, and an owner who cannot tell them apart will read a
  // held-back website as a broken one. `state` decided whether they reached this
  // page at all; `public_mode` decides what a visitor sees right now, and when
  // those disagree the owner is told so in plain words before anything else.
  const publicMode = await resolvePublicMode(context.supabase, context.businessId);

  return (
    <>
      {publicMode !== "site_spec" ? (
        <div className="sc-dash mx-auto w-full max-w-[900px] px-4 pt-6 sm:px-6">
          <div className="rounded-xl border border-[color:var(--d-line)] bg-[color:var(--d-raise)] px-4 py-3">
            <p className="text-sm font-semibold text-[color:var(--d-ink)]">
              {publicMode === "maintenance"
                ? "Your website is showing a temporary notice to visitors"
                : "Visitors are being shown your previous website"}
            </p>
            <p className="mt-1 text-sm text-[color:var(--d-muted)]">
              {publicMode === "maintenance"
                ? "Visitors see your name and contact details with a short message, and cannot book online. Everything you have made here is saved and unchanged — you can keep editing."
                : "Your new website is saved and you can keep editing it, but visitors are still being served your previous site until it is switched over."}
            </p>
          </div>
        </div>
      ) : null}
      <WebsiteStudioClient siteId={site.id} slug={site.slug ?? null} />
    </>
  );
}
