import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";

const PayloadSchema = z.object({
  siteId: z.string().uuid(),
  siteDocument: SiteDocumentSchema
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

  const { siteId, siteDocument } = parsed.data;

  const { data: site } = await (supabase as any)
    .from("builder_sites")
    .select("id,business_id")
    .eq("id", siteId)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { error } = await (supabase as any)
    .from("builder_sites")
    .update({
      template_id: siteDocument.templateId,
      tone: siteDocument.tone,
      site_document: siteDocument,
      primary_color: siteDocument.theme?.primary ?? null,
      secondary_color: siteDocument.theme?.bg ?? null,
      font_family: siteDocument.theme?.fontBody ?? null
    })
    .eq("id", siteId);

  if (error) {
    console.error("[BUILDER_SAVE_DRAFT_ERROR]", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
