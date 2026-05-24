import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import { getBuilderPlanForBusiness } from "@/lib/builder/plan";
import { BuilderEditorClient } from "@/app/(dashboard)/dashboard/builder/[siteId]/edit/BuilderEditorClient";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import { parseIntegratedTemplateSiteDocument } from "@/lib/builder/template-sites/schema";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { siteId: string };
};

export default async function BuilderEditorPage({ params }: PageProps) {
  const { user } = await requireUser("/dashboard/builder");
  if (!user?.id) {
    notFound();
  }

  const site = await getOwnedBuilderSite<{
    id: string;
    business_id: string;
    status: string | null;
    slug: string | null;
    business_name: string | null;
    site_document: unknown;
    published_url: string | null;
  }>(
    params.siteId,
    user.id,
    "id,business_id,status,slug,business_name,site_document,published_url"
  );

  if (!site) {
    notFound();
  }

  if (!site.site_document) {
    redirect(`/editor/${params.siteId}/generate`);
  }

  if (parseIntegratedTemplateSiteDocument(site.site_document)) {
    redirect(`/editor/${params.siteId}/generate`);
  }

  const websiteBuilderAccess = await getEntitlementAccess("website_builder", site.business_id);
  if (!websiteBuilderAccess.allowed) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Website editor locked</h2>
          <p className="mt-2 text-sm text-white/60">
            This site is preserved, but editing and publishing require a website-enabled SiroundChat plan.
          </p>
        </div>
        <UpgradeOverlay
          entitlementKey="website_builder"
          title="Unlock website editing again"
          description="Editing, generation, and publishing are available on Website Only, Website + AI, and Full Omni-Channel."
        >
          <div className="h-[28rem] rounded-[1.8rem] border border-white/10 bg-white/[0.03]" />
        </UpgradeOverlay>
      </div>
    );
  }

  const parsedDoc = SiteDocumentSchema.safeParse(site.site_document);
  if (!parsedDoc.success) {
    redirect(`/editor/${params.siteId}/generate`);
  }

  const { flags } = await getBuilderPlanForBusiness(site.business_id);

  return (
    <BuilderEditorClient
      initialSite={{
        id: site.id as string,
        status: (site.status as "draft" | "published" | "error") ?? "draft",
        slug: (site.slug as string | null) ?? "",
        businessName: site.business_name as string,
        siteDocument: parsedDoc.data,
        publishedUrl: site.published_url as string | null
      }}
      canPublish={flags.canPublish}
    />
  );
}
