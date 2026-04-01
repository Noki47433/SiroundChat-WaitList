import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import {
  buildPublishedSiteUrl,
  extractPublishedSiteSlugFromHost,
  getPublishedSiteRootDomain,
  getRequestHost
} from "@/lib/utils/published-site-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const host = getRequestHost(requestHeaders);
  const siteSlug = extractPublishedSiteSlugFromHost(host);

  if (siteSlug) {
    return {
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: `${buildPublishedSiteUrl(siteSlug)}sitemap.xml`
    };
  }

  const rootDomain = getPublishedSiteRootDomain();
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `https://${rootDomain}/sitemap.xml`
  };
}
