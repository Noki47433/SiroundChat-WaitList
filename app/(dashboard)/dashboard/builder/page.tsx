import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { ensureBusinessRow } from "@/lib/tenant";
import { Card } from "@/components/ui/card";
import { listOwnedBuilderSites } from "@/lib/builder/site-access";

export const dynamic = "force-dynamic";

export default async function BuilderDashboardPage() {
  const { user } = await requireUser("/dashboard/builder/new");
  if (!user?.id) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
        <h2 className="text-3xl font-semibold">Create your first site</h2>
        <p className="text-sm text-white/60">Log in to start building your website.</p>
      </div>
    );
  }

  const tenant = await getTenantFromSession(user?.id);
  let businessId = tenant.businessId;

  if (!businessId && tenant.userId) {
    try {
      const ensured = await ensureBusinessRow({ userId: tenant.userId });
      businessId = ensured.businessId;
    } catch (error) {
      console.error("[BUILDER_LIST_ENSURE_BUSINESS_ERROR]", error);
    }
  }

  if (!businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
        <h2 className="text-3xl font-semibold">Create your first site</h2>
        <p className="text-sm text-white/60">Log in to start building your website.</p>
      </div>
    );
  }

  const sites = await listOwnedBuilderSites<any>(
    businessId,
    user.id,
    "id,status,slug,template_key,business_name,updated_at,published_url"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
          <h2 className="mt-2 text-3xl font-semibold">My Websites</h2>
          <p className="mt-2 text-sm text-white/60">Manage your drafts and published sites.</p>
        </div>
        <Link
          href="/dashboard/builder/new"
          data-tutorial-target="builder-create-site"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#ffe169] to-[#f3b012] px-5 text-sm font-semibold text-[#2d1c00] shadow-[0_14px_28px_rgba(255,191,63,0.32)] transition hover:brightness-105"
        >
          Create new site
        </Link>
      </div>

      <Card>
        {sites && sites.length > 0 ? (
          <div className="grid gap-4">
            {sites.map((site: any) => (
              <Link
                key={site.id}
                href={`/dashboard/builder/${site.id}`}
                className="dashboard-inset rounded-2xl p-4 transition hover:border-[#ffd87266]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{site.business_name}</h3>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">{site.template_key}</p>
                    <p className="mt-2 text-sm text-white/60">Slug: {site.slug}</p>
                  </div>
                  <div className="text-right text-sm text-white/60">
                    <p className="capitalize">{site.status}</p>
                    <p className="mt-1">Updated {new Date(site.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {site.published_url ? (
                  <p className="mt-3 text-sm text-[#ffd974]">Live: {site.published_url}</p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-sm text-white/60">No sites yet. Create your first website.</div>
        )}
      </Card>
    </div>
  );
}
