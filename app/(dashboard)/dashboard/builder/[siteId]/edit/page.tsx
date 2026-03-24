import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import { getBuilderPlanForBusiness } from "@/lib/builder/plan";
import { BuilderEditorClient } from "@/app/(dashboard)/dashboard/builder/[siteId]/edit/BuilderEditorClient";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";

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
