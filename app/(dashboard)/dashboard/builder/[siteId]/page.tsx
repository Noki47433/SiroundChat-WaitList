import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { Card } from "@/components/ui/card";
import { BuilderOverviewActions } from "@/app/(dashboard)/dashboard/builder/[siteId]/BuilderOverviewActions";
import { getBuilderPlanForBusiness } from "@/lib/builder/plan";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { siteId: string };
};

export default async function BuilderOverviewPage({ params }: PageProps) {
  const { user } = await requireUser("/dashboard/builder");
  if (!user?.id) {
    notFound();
  }

  const site = await getOwnedBuilderSite<{
    id: string;
    business_id: string;
    status: string;
    slug: string;
    path: string | null;
    template_key: string | null;
    business_name: string | null;
    updated_at: string;
    published_url: string | null;
  }>(
    params.siteId,
    user.id,
    "id,business_id,status,slug,path,template_key,business_name,updated_at,published_url"
  );

  if (!site) {
    notFound();
  }

  const { flags } = await getBuilderPlanForBusiness(site.business_id);
  const detailsCard = (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2 text-sm text-white/70">
          <p>
            Status: <span className="font-semibold text-[#d8ecff]">{site.status}</span>
          </p>
          <p>
            Template: <span className="font-semibold text-[#d8ecff]">{site.template_key}</span>
          </p>
          <p>
            Slug: <span className="font-semibold text-[#d8ecff]">{site.slug}</span>
          </p>
          <p>
            Last updated: {new Date(site.updated_at).toLocaleString()}
          </p>
          {site.published_url ? (
            <p>
              URL: <span className="font-semibold text-[#ffd974]">{site.published_url}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <div className="space-y-2">
            <Link
              href={`/editor/${site.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="dashboard-pill inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white"
            >
              Edit site
            </Link>
            <p className="text-xs text-white/50">Opens in a new tab.</p>
            <Link
              href={`/editor/${site.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#ffd974]"
            >
              Open in new tab
            </Link>
          </div>
          <BuilderOverviewActions
            siteId={site.id}
            publishedUrl={site.published_url ?? null}
            canPublish={flags.canPublish}
          />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">My Website</p>
        <h2 className="mt-2 text-3xl font-semibold">{site.business_name}</h2>
        <p className="mt-2 text-sm text-white/60">Manage publishing and edits.</p>
      </div>

      {flags.canPublish ? (
        detailsCard
      ) : (
        <UpgradeOverlay
          entitlementKey="publish_website"
          title="Upgrade plan to publish websites"
          description="This workspace is on a chatbot-focused plan. Switch to Website or Bundle to publish sites."
        >
          {detailsCard}
        </UpgradeOverlay>
      )}
    </div>
  );
}
