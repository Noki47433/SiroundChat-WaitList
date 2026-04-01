import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import {
  buildPublishedSiteUrl,
  extractPublishedSiteSlugFromHost,
  getPublishedSiteRootDomain,
  getRequestHost
} from "@/lib/utils/published-site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = getRequestHost(requestHeaders);
  const siteSlug = extractPublishedSiteSlugFromHost(host);

  if (siteSlug) {
    const admin = getSupabaseAdminClientIfAvailable() as any;
    if (!admin) {
      return [{ url: buildPublishedSiteUrl(siteSlug), lastModified: new Date() }];
    }

    const { data: site, error } = await admin
      .from("builder_sites")
      .select("slug, updated_at, site_document")
      .eq("slug", siteSlug)
      .eq("status", "published")
      .maybeSingle();

    if (error || !site?.slug) {
      return [];
    }

    const parsedDocument = SiteDocumentSchema.safeParse(site.site_document);
    if (!parsedDocument.success) {
      return [{ url: buildPublishedSiteUrl(site.slug), lastModified: site.updated_at ? new Date(site.updated_at) : new Date() }];
    }

    const pages = parsedDocument.data.pages ?? [];
    const entries = pages
      .filter((page) => !page.isSystem)
      .map((page, index) => {
        const url = new URL(buildPublishedSiteUrl(site.slug));
        if (index > 0 && page.slug && page.slug !== "home" && page.slug !== "index") {
          url.searchParams.set("page", page.slug);
        }
        return {
          url: url.toString(),
          lastModified: site.updated_at ? new Date(site.updated_at) : new Date()
        };
      });

    return entries.length ? entries : [{ url: buildPublishedSiteUrl(site.slug), lastModified: site.updated_at ? new Date(site.updated_at) : new Date() }];
  }

  const rootDomain = getPublishedSiteRootDomain();
  return [{ url: `https://${rootDomain}`, lastModified: new Date() }];
}
