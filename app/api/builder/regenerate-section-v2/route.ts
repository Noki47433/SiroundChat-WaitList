import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { buildSectionPatch } from "@/lib/builder/generation/patch";
import { getGenerationPolicy } from "@/lib/builder/generation/policy";
import type { GenerationIntake } from "@/lib/builder/generation/types";
import { getBuilderPlanForRoute } from "@/lib/builder/plan";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";

export const runtime = "nodejs";

const PayloadSchema = z
  .object({
    siteId: z.string().uuid(),
    sectionId: z.string().optional(),
    sectionType: z
      .enum(["hero", "about", "services", "testimonials", "gallery", "pricing", "faq", "cta", "contact", "footer"])
      .optional(),
    prompt: z.string().trim().optional()
  })
  .refine((value) => Boolean(value.sectionId || value.sectionType), {
    message: "sectionId or sectionType required"
  });

const toIntake = (site: any, doc: any): GenerationIntake => {
  const brief = doc.siteBrief ?? {};
  const generationBrief =
    brief.generationBrief && typeof brief.generationBrief === "object"
      ? (brief.generationBrief as Record<string, unknown>)
      : site.generation_brief && typeof site.generation_brief === "object"
        ? (site.generation_brief as Record<string, unknown>)
      : {};
  const topServices = Array.isArray(generationBrief.topServices)
    ? generationBrief.topServices.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const proofPoints = Array.isArray(generationBrief.proofPoints)
    ? generationBrief.proofPoints.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const primaryCtaGoal =
    typeof generationBrief.primaryCtaGoal === "string" ? generationBrief.primaryCtaGoal : null;

  return {
    businessName: brief.businessName ?? site.business_name ?? "Business",
    businessType: brief.industry ?? site.industry ?? "service",
    subtype: null,
    location: site.contact_address ?? null,
    services: topServices,
    targetCustomer:
      typeof generationBrief.audience === "string" && generationBrief.audience.trim().length > 0
        ? generationBrief.audience.trim()
        : null,
    toneProfile: "professional",
    ctaIntent:
      primaryCtaGoal === "book_appointment" ||
      primaryCtaGoal === "book_call" ||
      primaryCtaGoal === "reserve_table"
        ? "reserve"
        : primaryCtaGoal === "request_demo"
          ? "demo"
          : primaryCtaGoal === "buy_now"
            ? "buy"
            : "contact",
    proofAssets: proofPoints,
    photosAvailable: Boolean(site.has_own_photos),
    description:
      (typeof generationBrief.coreOffer === "string" && generationBrief.coreOffer.trim().length > 0
        ? generationBrief.coreOffer.trim()
        : brief.description) ??
      site.description ??
      "",
    uploadedImages: (doc.mediaLibrary ?? []).map((image: any) => ({
      src: image.src,
      alt: image.alt,
      width: image.width,
      height: image.height
    }))
  };
};

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

  const { siteId, sectionId, sectionType } = parsed.data;
  const prompt = parsed.data.prompt?.trim() || "Rewrite this section to feel more polished, brand-specific, and readable without changing its purpose.";
  const site = await getOwnedBuilderSite<any>(
    siteId,
    userData.user.id,
    "id,business_id,business_name,industry,description,site_document,contact_address,has_own_photos,content_language,generation_brief"
  );

  if (!site?.site_document) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { flags } = await getBuilderPlanForRoute(site.business_id as string);
  if (!flags.canRegenerate) {
    return NextResponse.json({ error: "Plan does not allow regeneration" }, { status: 403 });
  }

  const parsedDoc = SiteDocumentSchema.safeParse(site.site_document);
  if (!parsedDoc.success) {
    return NextResponse.json({ error: "Invalid site document" }, { status: 400 });
  }

  const document = parsedDoc.data;
  const allSections = document.pages.flatMap((page) => page.sections);
  const targetSection = sectionId
    ? allSections.find((section) => section.id === sectionId)
    : allSections.find((section) => section.type === sectionType);

  if (!targetSection) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  if (
    !["hero", "about", "services", "testimonials", "gallery", "pricing", "faq", "cta", "contact", "footer"].includes(
      targetSection.type
    )
  ) {
    return NextResponse.json({ error: "Section type not supported for strict patch edits" }, { status: 400 });
  }

  const intake = toIntake(site, document);
  const policy = getGenerationPolicy(intake.businessType, intake.subtype, intake.ctaIntent);
  const openai = getOpenAIClient();

  const patch = await buildSectionPatch(targetSection, prompt, intake, policy, openai);
  if (!patch) {
    return NextResponse.json({ error: "Unable to generate strict section patch" }, { status: 500 });
  }

  const updatedDocument = {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.id === targetSection.id
          ? {
              ...section,
              content: {
                ...section.content,
                ...patch
              }
            }
          : section
      )
    }))
  };

  const finalValidation = SiteDocumentSchema.safeParse(updatedDocument);
  if (!finalValidation.success) {
    return NextResponse.json({ error: "Patch produced invalid document" }, { status: 500 });
  }

  const admin = getSupabaseServerAdminClient() as any;
  const { error: updateError } = await admin
    .from("builder_sites")
    .update({ site_document: finalValidation.data })
    .eq("id", siteId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save patch", message: updateError.message }, { status: 500 });
  }

  const updatedSection = finalValidation.data.pages
    .flatMap((page) => page.sections)
    .find((section) => section.id === targetSection.id);

  return NextResponse.json({
    section: updatedSection ?? null,
    patch
  });
}
