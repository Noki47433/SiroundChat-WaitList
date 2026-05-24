import { randomUUID } from "crypto";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { notFound, redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import { TemplateRenderer } from "@/components/website-builder/templates/TemplateRenderer";
import { TemplateSiteRenderer } from "@/components/templates/TemplateSiteRenderer";
import {
  parseIntegratedTemplateSiteDocument,
  type IntegratedTemplateSiteDocument
} from "@/lib/builder/template-sites/schema";
import {
  buildPublishedSiteUrl,
  extractPublishedSiteSlugFromHost,
  getPublishedSiteUrlMode,
  getRequestHost
} from "@/lib/utils/published-site-url";
import { getBusinessEntitlementAccess } from "@/lib/server/billing-access";
import { resolveLiveChat } from "@/lib/website-builder/live-chat";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { slug: string };
  searchParams?: { preview?: string; siteId?: string; page?: string };
};

const buildCanonicalUrl = (slug: string, searchParams?: PageProps["searchParams"]) => {
  const url = new URL(buildPublishedSiteUrl(slug));
  if (searchParams?.page) {
    url.searchParams.set("page", searchParams.page);
  }
  return url.toString();
};

const resolveAbsoluteUrl = (value: string | null | undefined, canonicalUrl: string) => {
  if (!value) return undefined;
  try {
    return new URL(value, canonicalUrl).toString();
  } catch {
    return undefined;
  }
};

const getLegacySeoFields = (document: unknown, fallbackBusinessName?: string | null) => {
  const parsed = SiteDocumentSchema.safeParse(document);
  if (!parsed.success) return null;
  const sections = parsed.data.pages?.[0]?.sections ?? [];
  const hero = sections.find((section) => section.type === "hero");
  const headline = (hero?.content as { headline?: string; subheadline?: string } | undefined)?.headline;
  const subheadline = (hero?.content as { headline?: string; subheadline?: string } | undefined)?.subheadline;
  const businessName = parsed.data.siteBrief?.businessName ?? fallbackBusinessName ?? "Business";
  return {
    title: parsed.data.seo?.title ?? headline ?? businessName,
    description: parsed.data.seo?.description ?? subheadline ?? `Learn more about ${businessName}.`,
    ogImage: parsed.data.seo?.ogImage ?? null,
    pageTitle: headline ?? null
  };
};

const getIntegratedSeoFields = (
  document: IntegratedTemplateSiteDocument,
  fallbackBusinessName?: string | null
) => {
  const businessName = document.meta.businessName ?? fallbackBusinessName ?? "Business";
  return {
    title: document.meta.seo.title,
    description: document.meta.seo.description,
    ogImage: document.meta.seo.ogImage ?? document.images.hero?.url ?? null,
    pageTitle: document.content.hero.headline ?? businessName
  };
};

const getSeoFields = (
  document: unknown,
  fallbackBusinessName?: string | null
) => {
  const integrated = parseIntegratedTemplateSiteDocument(document);
  if (integrated) {
    return getIntegratedSeoFields(integrated, fallbackBusinessName);
  }
  return getLegacySeoFields(document, fallbackBusinessName);
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

const ensureBusinessWidgetKey = async (
  admin: any,
  businessId: string,
  currentWidgetKey?: string | null
) => {
  const trimmed = currentWidgetKey?.trim();
  if (trimmed) return trimmed;

  const nextWidgetKey = randomUUID();
  const { error } = await admin
    .from("businesses")
    .update({ widget_key: nextWidgetKey })
    .eq("id", businessId);

  if (error) {
    console.error("[PUBLIC_SITE_WIDGET_KEY_ERROR]", error);
    return null;
  }

  return nextWidgetKey;
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
      primary_color: string | null;
      secondary_color: string | null;
    }>(
      siteId,
      userData.user.id,
      "id,business_id,slug,site_document,business_name,logo_url,primary_color,secondary_color"
    );

    if (!site?.site_document) return null;

    const admin = getSupabaseAdminClient();
    const { data: business } = await (admin as any)
      .from("businesses")
      .select("widget_key")
      .eq("id", site.business_id)
      .maybeSingle();
    const widgetKey = await ensureBusinessWidgetKey(
      admin as any,
      site.business_id,
      business?.widget_key ?? null
    );
    const siteInjectionAccess = await getBusinessEntitlementAccess(
      site.business_id as string,
      "chatbot_website_injection"
    );
    const widgetRuntimeAllowed = siteInjectionAccess.allowed;

    const integratedDoc = parseIntegratedTemplateSiteDocument(site.site_document);
    if (integratedDoc) {
      return {
        site,
        document: integratedDoc,
        widgetKey: widgetRuntimeAllowed ? widgetKey : null,
        liveChat: { enabled: false, inlineScript: null },
        preview: true
      };
    }

    const parsedDoc = SiteDocumentSchema.safeParse(site.site_document);
    if (!parsedDoc.success) return null;

    const legacyWidgetKey = widgetKey;

    const withBranding = {
      ...parsedDoc.data,
      siteBrief: {
        ...parsedDoc.data.siteBrief,
        businessName: parsedDoc.data.siteBrief?.businessName ?? site.business_name ?? undefined,
        logoUrl: parsedDoc.data.siteBrief?.logoUrl ?? site.logo_url ?? undefined
      }
    };
    const liveChat = resolveLiveChat(withBranding, { widgetKey: legacyWidgetKey });

    return {
      site,
      document: liveChat.document,
      widgetKey: widgetRuntimeAllowed ? legacyWidgetKey : null,
      liveChat: widgetRuntimeAllowed
        ? liveChat
        : { ...liveChat, enabled: false, scriptSrc: null, inlineScript: null },
      preview: true
    };
  }

  const admin = getSupabaseAdminClient();
  const { data: site } = await (admin as any)
    .from("builder_sites")
    .select("id,business_id,slug,status,site_document,business_name,logo_url,industry,primary_color,secondary_color")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!site?.site_document) return null;

  const { data: business } = await (admin as any)
    .from("businesses")
    .select("widget_key")
    .eq("id", site.business_id)
    .maybeSingle();
  const widgetKey = await ensureBusinessWidgetKey(
    admin as any,
    site.business_id,
    business?.widget_key ?? null
  );
  const siteInjectionAccess = await getBusinessEntitlementAccess(
    site.business_id as string,
    "chatbot_website_injection"
  );
  const widgetRuntimeAllowed = siteInjectionAccess.allowed;

  const integratedDoc = parseIntegratedTemplateSiteDocument(site.site_document);
  if (integratedDoc) {
    return {
      site,
      document: integratedDoc,
      widgetKey: widgetRuntimeAllowed ? widgetKey : null,
      liveChat: { enabled: false, inlineScript: null },
      preview: false
    };
  }

  const parsedDoc = SiteDocumentSchema.safeParse(site.site_document);
  if (!parsedDoc.success) return null;

  const withBranding = {
    ...parsedDoc.data,
    siteBrief: {
      ...parsedDoc.data.siteBrief,
      businessName: parsedDoc.data.siteBrief?.businessName ?? site.business_name ?? undefined,
      logoUrl: parsedDoc.data.siteBrief?.logoUrl ?? site.logo_url ?? undefined,
      industry: parsedDoc.data.siteBrief?.industry ?? site.industry ?? undefined
    }
  };
  const liveChat = resolveLiveChat(withBranding, { widgetKey });

  return {
    site,
    document: liveChat.document,
    widgetKey: widgetRuntimeAllowed ? widgetKey : null,
    liveChat: widgetRuntimeAllowed
      ? liveChat
      : { ...liveChat, enabled: false, scriptSrc: null, inlineScript: null },
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

  const siteSlug = data.site.slug ?? params.slug;
  const businessName =
    parseIntegratedTemplateSiteDocument(data.document)?.meta.businessName ??
    (data.document as any)?.siteBrief?.businessName ??
    data.site.business_name ??
    "Business";
  const seo = getSeoFields(data.document, businessName);
  const canonicalUrl = buildCanonicalUrl(siteSlug, searchParams);
  const ogImage = resolveAbsoluteUrl(seo?.ogImage ?? null, canonicalUrl);
  return {
    title: {
      absolute: seo?.title ?? businessName
    },
    description: seo?.description ?? `Learn more about ${businessName}.`,
    alternates: preview ? undefined : { canonical: canonicalUrl },
    robots: preview ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: seo?.title ?? businessName,
      description: seo?.description ?? `Learn more about ${businessName}.`,
      url: preview ? undefined : canonicalUrl,
      siteName: businessName,
      type: "website",
      images: ogImage ? [ogImage] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title: seo?.title ?? businessName,
      description: seo?.description ?? `Learn more about ${businessName}.`,
      images: ogImage ? [ogImage] : undefined
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

  const siteSlug = data.site.slug ?? params.slug;
  const requestHeaders = await headers();
  const requestHost = getRequestHost(requestHeaders);
  const requestHostSlug = extractPublishedSiteSlugFromHost(requestHost);
  const canonicalUrl = buildCanonicalUrl(siteSlug, searchParams);
  const integratedDoc = parseIntegratedTemplateSiteDocument(data.document);

  console.info("[BUILDER_SITE_RENDER_PIPELINE]", {
    siteId: data.site.id,
    slug: siteSlug,
    preview: data.preview,
    renderer: integratedDoc ? "integrated_template" : "legacy_template",
    template: integratedDoc?.template ?? null
  });

  if (!data.preview && getPublishedSiteUrlMode() === "subdomain" && requestHostSlug !== siteSlug) {
    redirect(canonicalUrl);
  }

  const widgetKey = data.widgetKey ?? data.site.id;
  const businessName =
    integratedDoc?.meta.businessName ??
    (data.document as any)?.siteBrief?.businessName ??
    data.site.business_name ??
    "Business";
  const seo = getSeoFields(data.document, businessName);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": buildStructuredDataType(
      integratedDoc?.meta.industry ?? (data.document as any)?.siteBrief?.industry
    ),
    name: businessName,
    image:
      integratedDoc?.images.hero?.url ??
      (data.document as any)?.siteBrief?.logoUrl ??
      resolveAbsoluteUrl(seo?.ogImage ?? null, canonicalUrl) ??
      undefined,
    description: seo?.description ?? undefined,
    url: data.preview ? undefined : canonicalUrl
  };

  return (
    <>
      {integratedDoc ? (
        <TemplateSiteRenderer
          document={integratedDoc}
          siteId={data.site.id as string}
          primaryColor={(data.site as { primary_color?: string | null }).primary_color ?? null}
          secondaryColor={(data.site as { secondary_color?: string | null }).secondary_color ?? null}
        />
      ) : (
        <TemplateRenderer
          site={data.document as any}
          preview={data.preview}
          analytics={{
            businessId: data.site.business_id as string,
            siteId: data.site.id as string,
            pageTitle: seo?.pageTitle ?? null,
            enabled: !data.preview
          }}
        />
      )}
      {!data.preview ? (
        <Script
          id={`site-structured-data-${data.site.id}`}
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      ) : null}
      {integratedDoc && widgetKey ? (
        <Script src={`/api/widget/loader?key=${widgetKey}`} strategy="afterInteractive" />
      ) : null}
      {!integratedDoc && !data.preview && !data.liveChat.enabled && widgetKey ? (
        <Script src={`/api/widget/loader?key=${widgetKey}`} strategy="afterInteractive" />
      ) : null}
      {!integratedDoc && !data.preview && !data.liveChat.enabled && data.liveChat.inlineScript ? (
        <Script
          id={`site-live-chat-inline-${data.site.id}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: data.liveChat.inlineScript }}
        />
      ) : null}
    </>
  );
}
