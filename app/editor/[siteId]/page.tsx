import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import { getBuilderPlanForBusiness } from "@/lib/builder/plan";
import { EditorShell } from "@/app/editor/[siteId]/EditorShell";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { siteId: string };
};

export default async function EditorPage({ params }: PageProps) {
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
    primary_color: string | null;
    secondary_color: string | null;
    font_family: string | null;
    logo_url: string | null;
  }>(
    params.siteId,
    user.id,
    "id,business_id,status,slug,business_name,site_document,published_url,primary_color,secondary_color,font_family,logo_url"
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

  const hydratedDocument = {
    ...parsedDoc.data,
    siteBrief: {
      ...parsedDoc.data.siteBrief,
      businessName: parsedDoc.data.siteBrief?.businessName ?? site.business_name ?? undefined,
      logoUrl: parsedDoc.data.siteBrief?.logoUrl ?? site.logo_url ?? undefined
    }
  };

  const { flags } = await getBuilderPlanForBusiness(site.business_id);

  return (
    <EditorShell
      initialSite={{
        id: site.id as string,
        slug: site.slug as string,
        businessName: site.business_name as string,
        siteDocument: hydratedDocument,
        publishedUrl: site.published_url as string | null
      }}
      canPublish={flags.canPublish}
    />
  );
}
