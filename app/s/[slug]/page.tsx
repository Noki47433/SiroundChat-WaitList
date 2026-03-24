import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import { TemplateRenderer } from "@/components/website-builder/templates/TemplateRenderer";
import { getBaseUrl } from "@/lib/utils/base-url";
import { resolveLiveChat } from "@/lib/website-builder/live-chat";

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

const buildStructuredDataType = (industry?: string | null) => {
  const normalized = industry?.trim().toLowerCase() ?? "";
  if (normalized.includes("barber")) return "Barbershop";
  if (normalized.includes("restaurant")) return "Restaurant";
  if (normalized.includes("dental") || normalized.includes("dentist")) return "Dentist";
  if (normalized.includes("real estate") || normalized.includes("real-estate") || normalized.includes("realty")) {
    return "RealEstateAgent";
  }
  return "LocalBusiness";
};

const loadSite = async (slug: string, preview: boolean, siteId?: string | null) => {
  if (preview && siteId) {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;

    const site = await getOwnedBuilderSite<{
      id: string;
      business_id: string;
      slug: string | null;
      site_document: unknown;
      business_name: string | null;
      logo_url: string | null;
    }>(siteId, userData.user.id, "id,business_id,slug,site_document,business_name,logo_url");

    if (!site?.site_document) return null;

    const parsedDoc = SiteDocumentSchema.safeParse(site.site_document);
    if (!parsedDoc.success) return null;

    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("widget_key")
      .eq("id", site.business_id)
      .maybeSingle();

    const withBranding = {
      ...parsedDoc.data,
      siteBrief: {
        ...parsedDoc.data.siteBrief,
        businessName: parsedDoc.data.siteBrief?.businessName ?? site.business_name ?? undefined,
        logoUrl: parsedDoc.data.siteBrief?.logoUrl ?? site.logo_url ?? undefined
      }
    };
    const liveChat = resolveLiveChat(withBranding, { widgetKey: business?.widget_key ?? null });

    return {
      site,
      document: liveChat.document,
      widgetKey: business?.widget_key ?? null,
      liveChat,
      preview: true
    };
  }

  const admin = getSupabaseAdminClient();
  const { data: site } = await (admin as any)
    .from("builder_sites")
    .select("id,business_id,slug,status,site_document,business_name,logo_url,industry")
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

  const withBranding = {
    ...parsedDoc.data,
    siteBrief: {
      ...parsedDoc.data.siteBrief,
      businessName: parsedDoc.data.siteBrief?.businessName ?? site.business_name ?? undefined,
      logoUrl: parsedDoc.data.siteBrief?.logoUrl ?? site.logo_url ?? undefined,
      industry: parsedDoc.data.siteBrief?.industry ?? site.industry ?? undefined
    }
  };
  const liveChat = resolveLiveChat(withBranding, { widgetKey: business?.widget_key ?? null });

  return {
    site,
    document: liveChat.document,
    widgetKey: business?.widget_key ?? null,
    liveChat,
    preview: false
  };
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const preview = searchParams?.preview === "true";
  const siteId = searchParams?.siteId ?? null;
  const data = await loadSite(params.slug, preview, siteId);
  if (!data) {
    return { title: "Site not found" };
  }

  const seo = getSeoFields(data.document);
  const canonicalUrl = `${getBaseUrl()}/s/${data.site.slug ?? params.slug}`;
  return {
    title: seo?.title ?? "SiroundChat Site",
    description: seo?.description ?? "Learn more about this business.",
    alternates: preview ? undefined : { canonical: canonicalUrl },
    robots: preview ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: seo?.title ?? "SiroundChat Site",
      description: seo?.description ?? "Learn more about this business.",
      url: preview ? undefined : canonicalUrl,
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
  const canonicalUrl = `${getBaseUrl()}/s/${data.site.slug ?? params.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": buildStructuredDataType(data.document.siteBrief?.industry),
    name: data.document.siteBrief?.businessName ?? "Business",
    image: data.document.siteBrief?.logoUrl ?? seo?.ogImage ?? undefined,
    description: seo?.description ?? undefined,
    url: data.preview ? undefined : canonicalUrl
  };

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
        <Script
          id={`site-structured-data-${data.site.id}`}
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      ) : null}
      {!data.preview && !data.liveChat.enabled && widgetKey ? (
        <Script src={`/api/widget/loader?key=${widgetKey}`} strategy="afterInteractive" />
      ) : null}
      {!data.preview && !data.liveChat.enabled && data.liveChat.inlineScript ? (
        <Script
          id={`site-live-chat-inline-${data.site.id}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: data.liveChat.inlineScript }}
        />
      ) : null}
    </>
  );
}
