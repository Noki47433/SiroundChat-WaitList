import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import { getBuilderPlanForBusiness } from "@/lib/builder/plan";
import { EditorShell } from "@/app/editor/[siteId]/EditorShell";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { siteId: string };
};

export default async function EditorPage({ params }: PageProps) {
  await requireUser("/dashboard/builder");
  const tenant = await getTenantFromSession();
  const supabase = getSupabaseServerClient();

  if (!tenant.businessId) {
    notFound();
  }

  const { data: site } = await (supabase as any)
    .from("builder_sites")
    .select(
      "id,status,slug,business_name,site_document,published_url,primary_color,secondary_color,font_family,logo_url"
    )
    .eq("id", params.siteId)
    .eq("business_id", tenant.businessId)
    .maybeSingle();

  if (!site?.site_document) {
    notFound();
  }

  const parsedDoc = SiteDocumentSchema.safeParse(site.site_document);
  if (!parsedDoc.success) {
    notFound();
  }

  const { flags } = await getBuilderPlanForBusiness(tenant.businessId);

  return (
    <EditorShell
      initialSite={{
        id: site.id as string,
        slug: site.slug as string,
        businessName: site.business_name as string,
        siteDocument: parsedDoc.data,
        publishedUrl: site.published_url as string | null
      }}
      canPublish={flags.canPublish}
    />
  );
}
