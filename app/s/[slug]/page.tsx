import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import { TemplateRenderer } from "@/components/website-builder/templates/TemplateRenderer";

export const revalidate = 300;

type PageProps = {
  params: { slug: string };
  searchParams?: { preview?: string; siteId?: string; page?: string };
};

const getSeoFields = (document: unknown) => {
  const parsed = SiteDocumentSchema.safeParse(document);
  if (!parsed.success) return null;
  const sections = parsed.data.pages?.[0]?.sections ?? [];
  const hero = sections.find((section) => section.type === "hero");
  const headline = (hero?.content as { headline?: string; subheadline?: string } | undefined)?.headline;
  const subheadline = (hero?.content as { headline?: string; subheadline?: string } | undefined)?.subheadline;
  return {
    title: parsed.data.seo?.title ?? headline ?? "SiroundChat Site",
    description: parsed.data.seo?.description ?? subheadline ?? "Learn more about this business.",
    ogImage: parsed.data.seo?.ogImage ?? null,
    pageTitle: headline ?? null
  };
};

const loadSite = async (slug: string, preview: boolean, siteId?: string | null) => {
  if (preview && siteId) {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;

    const { data: site } = await (supabase as any)
      .from("builder_sites")
      .select("id,business_id,slug,site_document")
      .eq("id", siteId)
      .maybeSingle();

    if (!site?.site_document) return null;

    const parsedDoc = SiteDocumentSchema.safeParse(site.site_document);
    if (!parsedDoc.success) return null;

    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("widget_key")
      .eq("id", site.business_id)
      .maybeSingle();

    return {
      site,
      document: parsedDoc.data,
      widgetKey: business?.widget_key ?? null,
      preview: true
    };
  }

  const admin = getSupabaseAdminClient();
  const { data: site } = await (admin as any)
    .from("builder_sites")
    .select("id,business_id,slug,status,site_document")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!site?.site_document) return null;

  const parsedDoc = SiteDocumentSchema.safeParse(site.site_document);
  if (!parsedDoc.success) return null;

  const { data: business } = await (admin as any)
    .from("businesses")
    .select("widget_key")
    .eq("id", site.business_id)
    .maybeSingle();

  return {
    site,
    document: parsedDoc.data,
    widgetKey: business?.widget_key ?? null,
    preview: false
  };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await loadSite(params.slug, false);
  if (!data) {
    return { title: "Site not found" };
  }

  const seo = getSeoFields(data.document);
  return {
    title: seo?.title ?? "SiroundChat Site",
    description: seo?.description ?? "Learn more about this business.",
    openGraph: {
      title: seo?.title ?? "SiroundChat Site",
      description: seo?.description ?? "Learn more about this business.",
      images: seo?.ogImage ? [seo.ogImage] : undefined
    }
  };
}

export default async function PublicSitePage({ params, searchParams }: PageProps) {
  const preview = searchParams?.preview === "true";
  const siteId = searchParams?.siteId ?? null;
  const data = await loadSite(params.slug, preview, siteId);

  if (!data) {
    notFound();
  }

  const widgetKey = data.widgetKey ?? data.site.id;
  const seo = getSeoFields(data.document);

  return (
    <>
      <TemplateRenderer
        site={data.document}
        preview={data.preview}
        analytics={{
          businessId: data.site.business_id as string,
          siteId: data.site.id as string,
          pageTitle: seo?.pageTitle ?? null,
          enabled: !data.preview
        }}
      />
      {!data.preview ? (
        <Script src={`/api/widget/loader?key=${widgetKey}`} strategy="afterInteractive" />
      ) : null}
    </>
  );
}
