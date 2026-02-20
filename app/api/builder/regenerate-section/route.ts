import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { regenerateSection } from "@/lib/builder/ai";
import { SectionKeys, SiteContentSchema } from "@/lib/builder/types";
import { getBuilderPlanForRoute } from "@/lib/builder/plan";

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

  const payload = await request.json().catch(() => null);
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { siteId, sectionKey } = parsed.data;

  const { data: site } = await (supabase as any)
    .from("builder_sites")
    .select(
      "id,business_id,business_name,industry,description,primary_color,logo_url,contact_email,contact_phone,contact_address"
    )
    .eq("id", siteId)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { flags } = await getBuilderPlanForRoute(site.business_id as string);
  if (!flags.canRegenerate) {
    return NextResponse.json({ error: "Plan does not allow regeneration" }, { status: 403 });
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
      businessName: site.business_name,
      industry: site.industry,
      description: site.description,
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
