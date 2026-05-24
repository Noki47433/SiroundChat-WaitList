import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { regenerateSection } from "@/lib/builder/ai";
import { SectionKeys, SiteContentSchema } from "@/lib/builder/types";

const PayloadSchema = z.object({
  siteId: z.string().uuid(),
  sectionKey: z.enum(SectionKeys)
});

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { siteId, sectionKey } = parsed.data;

  const site = await getOwnedBuilderSite<{
    id: string;
    business_id: string;
    business_name: string | null;
    industry: string | null;
    description: string | null;
    primary_color: string | null;
    logo_url: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    contact_address: string | null;
  }>(
    siteId,
    userData.user.id,
    "id,business_id,business_name,industry,description,primary_color,logo_url,contact_email,contact_phone,contact_address"
  );

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const billingAccess = await getBusinessEntitlementAccess(site.business_id as string, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
  }

  const { data: contentRow } = await (supabase as any)
    .from("builder_site_content")
    .select("content")
    .eq("site_id", siteId)
    .maybeSingle();

  if (!contentRow?.content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const parsedContent = SiteContentSchema.safeParse(contentRow.content);
  if (!parsedContent.success) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }

  const regenerated = await regenerateSection(
    {
      businessName: site.business_name ?? "Business",
      industry: site.industry ?? "service",
      description: site.description ?? "",
      primaryColor: site.primary_color,
      logoUrl: site.logo_url,
      contact: {
        email: site.contact_email,
        phone: site.contact_phone,
        address: site.contact_address
      }
    },
    sectionKey,
    parsedContent.data
  );

  if (!regenerated) {
    return NextResponse.json({ error: "Failed to regenerate section" }, { status: 500 });
  }

  const updatedContent = {
    ...parsedContent.data,
    [sectionKey]: regenerated
  };

  const validated = SiteContentSchema.safeParse(updatedContent);
  if (!validated.success) {
    return NextResponse.json({ error: "Regenerated content invalid" }, { status: 500 });
  }

  const { error: updateError } = await (supabase as any)
    .from("builder_site_content")
    .update({ content: validated.data })
    .eq("site_id", siteId);

  if (updateError) {
    console.error("[BUILDER_REGENERATE_ERROR]", updateError);
    return NextResponse.json({ error: "Failed to save content" }, { status: 500 });
  }

  return NextResponse.json({ content: validated.data });
}
