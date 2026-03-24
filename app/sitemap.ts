import type { MetadataRoute } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBaseUrl } from "@/lib/utils/base-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const admin = getSupabaseAdminClient();
  const { data: sites } = await (admin as any)
    .from("builder_sites")
    .select("slug,updated_at,status")
    .eq("status", "published")
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(5000);

  return [
    {
      url: baseUrl,
      lastModified: new Date()
    },
    ...((sites ?? []) as Array<{ slug: string | null; updated_at: string | null }>)
      .filter((site) => site.slug)
      .map((site) => ({
        url: `${baseUrl}/s/${site.slug}`,
        lastModified: site.updated_at ? new Date(site.updated_at) : new Date()
      }))
  ];
}
