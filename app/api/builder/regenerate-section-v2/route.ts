import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getOpenAIClient } from "@/lib/ai/client";
import { buildSectionPatch } from "@/lib/builder/generation/patch";
import { getGenerationPolicy } from "@/lib/builder/generation/policy";
import type { GenerationIntake } from "@/lib/builder/generation/types";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import {
  appendStudioRefinementToSiteDocument,
  attachStudioMetadataToSiteDocument,
  resolveStudioGenerationSpec
} from "@/lib/website-studio/normalize";
import {
  createStudioGenerationProvider,
  getCurrentStudioProviderMetadata
} from "@/lib/website-studio/providers";
import { classifyStudioRefinementRequest } from "@/lib/website-studio/refinement";

export const runtime = "nodejs";
const REFINEMENT_DUPLICATE_WINDOW_MS = 60_000;

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

const isRecentTimestamp = (value?: string | null, windowMs = REFINEMENT_DUPLICATE_WINDOW_MS) => {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= windowMs;
};

const hasRecentMatchingRefinement = (
  document: z.infer<typeof SiteDocumentSchema>,
  refinementPlan: ReturnType<typeof classifyStudioRefinementRequest>
) => {
  const latest = document.siteBrief?.studio?.refinements?.at(-1);
  if (!latest) return false;
  if (!isRecentTimestamp(latest.createdAt)) return false;
  return (
    latest.request === refinementPlan.request &&
    latest.scope === refinementPlan.scope &&
    latest.target.sectionId === refinementPlan.target.sectionId &&
    latest.target.pageId === refinementPlan.target.pageId &&
    latest.target.sectionType === refinementPlan.target.sectionType
  );
};

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

  const billingAccess = await getBusinessEntitlementAccess(site.business_id as string, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
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
  const targetPage = targetSection
    ? document.pages.find((page) => page.sections.some((section) => section.id === targetSection.id))
    : null;

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

  const refinementPlan = classifyStudioRefinementRequest(prompt, {
    pageId: targetPage?.id ?? null,
    sectionId: targetSection.id,
    sectionType: targetSection.type
  });
  const existingStudioSpec = document.siteBrief?.studio?.generationSpec;
  const studioSpec = resolveStudioGenerationSpec({
    studioSpec: existingStudioSpec,
    siteId,
    businessId: site.business_id,
    businessName: site.business_name ?? document.siteBrief?.businessName ?? "Restaurant",
    industry: site.industry ?? document.siteBrief?.industry ?? "Restaurant",
    description: site.description ?? document.siteBrief?.description ?? "",
    tone: document.siteBrief?.tone ?? existingStudioSpec?.business.toneStyle ?? "modern",
    templateId: document.templateId,
    primaryColor: document.theme.primary,
    secondaryColor: document.theme.bg,
    fontFamily: document.theme.fontBody,
    logoUrl: document.siteBrief?.logoUrl ?? existingStudioSpec?.business.logoUrl ?? null,
    contact: {
      email: existingStudioSpec?.business.email ?? null,
      phone: existingStudioSpec?.business.phone ?? null,
      address: site.contact_address ?? existingStudioSpec?.business.address ?? null
    },
    openingHours: existingStudioSpec?.business.openingHours ?? null,
    socials: existingStudioSpec?.business.socials ?? {},
    services: Array.isArray(document.siteBrief?.generationBrief?.topServices)
      ? document.siteBrief.generationBrief?.topServices
      : [],
    proofAssets: Array.isArray(document.siteBrief?.generationBrief?.proofPoints)
      ? document.siteBrief.generationBrief?.proofPoints
      : [],
    uploadedImages: (document.mediaLibrary ?? []).map((image: any) => ({
      src: image.src,
      alt: image.alt,
      width: image.width,
      height: image.height
    })),
    features: {
      includeGallery: allSections.some((section) => section.type === "gallery" && section.enabled),
      includeTestimonials: allSections.some((section) => section.type === "testimonials" && section.enabled),
      includeReservation: allSections.some((section) => section.type === "reservation" && section.enabled)
    },
    hasOwnPhotos: Boolean(site.has_own_photos),
    studioSource: existingStudioSpec?.source ?? "legacy_generation"
  });
  const studioProvider = createStudioGenerationProvider();
  if (studioProvider.metadata.provider === "v0" && hasRecentMatchingRefinement(document, refinementPlan)) {
    return NextResponse.json({
      section: targetSection,
      patch: null,
      provider: document.siteBrief?.studio?.provider ?? null,
      reused: true
    });
  }
  if (studioProvider.metadata.provider === "v0" && refinementPlan.providerAllowed) {
    const providerResult = await studioProvider.regenerateSection({
      spec: studioSpec,
      currentDocument: document,
      refinement: refinementPlan,
      sectionId: targetSection.id
    });

    if (providerResult.ok && providerResult.siteDocument) {
      const providerUpdatedDocument = appendStudioRefinementToSiteDocument(
        attachStudioMetadataToSiteDocument(
          providerResult.siteDocument,
          studioSpec,
          providerResult.metadata
        ),
        refinementPlan
      );
      const providerValidation = SiteDocumentSchema.safeParse(providerUpdatedDocument);
      if (providerValidation.success) {
        const admin = getSupabaseServerAdminClient() as any;
        const { error: updateError } = await admin
          .from("builder_sites")
          .update({ site_document: providerValidation.data })
          .eq("id", siteId);

        if (updateError) {
          return NextResponse.json({ error: "Failed to save refinement", message: updateError.message }, { status: 500 });
        }

        const updatedSection = providerValidation.data.pages
          .flatMap((page) => page.sections)
          .find((section) => section.id === targetSection.id);

        return NextResponse.json({
          section: updatedSection ?? null,
          patch: null,
          provider: providerResult.metadata
        });
      }
    }
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
  const updatedDocumentWithRefinement = appendStudioRefinementToSiteDocument(
    attachStudioMetadataToSiteDocument(
      updatedDocument,
      studioSpec,
      document.siteBrief?.studio?.provider ?? getCurrentStudioProviderMetadata("section-patch")
    ),
    refinementPlan
  );

  const finalValidation = SiteDocumentSchema.safeParse(updatedDocumentWithRefinement);
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
