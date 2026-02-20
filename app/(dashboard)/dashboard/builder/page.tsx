import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function BuilderDashboardPage() {
  await requireUser("/dashboard/builder/new");
  const tenant = await getTenantFromSession();

  if (!tenant.businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
        <h2 className="text-3xl font-semibold">Create your first site</h2>
        <p className="text-sm text-white/60">Log in to start building your website.</p>
      </div>
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: sites } = await (supabase as any)
    .from("builder_sites")
    .select("id,status,slug,template_key,business_name,updated_at,published_url")
    .eq("business_id", tenant.businessId)
    .order("updated_at", { ascending: false });

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
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-yellow-400 px-5 text-sm font-semibold text-neutral-900"
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
                className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
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
                  <p className="mt-3 text-sm text-yellow-300">Live: {site.published_url}</p>
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
