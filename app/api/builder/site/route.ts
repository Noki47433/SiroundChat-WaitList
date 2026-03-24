import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";
import { buildFallbackContent } from "@/lib/builder/ai";
import {
  CTA_GOALS,
  CONTENT_LANGUAGES,
  createEmptyGenerationBrief,
  sanitizeGenerationBrief
} from "@/lib/builder/generation-config";
import { buildSeoFields, buildSitePath, selectTemplateKey, slugify } from "@/lib/builder/utils";

const selectTemplateId = (industry: string, templateId?: string | null) => {
  const trimmed = (templateId ?? "").trim();
  if (trimmed) return trimmed;
  const normalized = industry.toLowerCase();
  if (normalized.includes("restaurant")) return "restaurant-editorial";
  if (normalized.includes("clinic") || normalized.includes("medical")) return "clinic-clean";
  if (normalized.includes("beauty") || normalized.includes("salon") || normalized.includes("spa")) {
    return "beauty-lux";
  }
  if (normalized.includes("portfolio") || normalized.includes("creative")) return "portfolio-minimal";
  if (normalized.includes("ecommerce") || normalized.includes("shop") || normalized.includes("store")) {
    return "ecommerce-simple";
  }
  if (normalized.includes("hospitality") || normalized.includes("hotel") || normalized.includes("resort")) {
    return "hospitality-resort";
  }
  if (normalized.includes("consulting") || normalized.includes("corporate") || normalized.includes("agency")) {
    return "corporate-sleek";
  }
  if (normalized.includes("service")) return "auto-modern";
  return "auto-modern";
};

const ColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/)
  .optional()
  .nullable();

const ToneSchema = z.string().min(1).optional().nullable();

const PagesModeSchema = z.enum(["one", "multi"]).optional().nullable();

const ContactSchema = z
  .object({
    email: z.string().email().optional().nullable(),
    phone: z.string().min(2).optional().nullable(),
    address: z.string().min(2).optional().nullable()
  })
  .optional()
  .nullable();

const FeaturesSchema = z
  .object({
    includeServices: z.boolean().optional(),
    includeTestimonials: z.boolean().optional(),
    includePricing: z.boolean().optional(),
    includeFaq: z.boolean().optional(),
    includeContact: z.boolean().optional(),
    includeReservation: z.boolean().optional(),
    includeGallery: z.boolean().optional()
  })
  .optional()
  .nullable();

const SocialsSchema = z
  .object({
    instagram: z.string().optional().nullable(),
    facebook: z.string().optional().nullable(),
    tiktok: z.string().optional().nullable(),
    linkedin: z.string().optional().nullable(),
    website: z.string().optional().nullable()
  })
  .optional()
  .nullable();

const ContentLanguageSchema = z
  .enum(CONTENT_LANGUAGES.map((item) => item.value) as [string, ...string[]])
  .optional()
  .nullable();

const GenerationBriefSchema = z
  .object({
    audience: z.string().optional().nullable(),
    coreOffer: z.string().optional().nullable(),
    primaryCtaGoal: z.enum(CTA_GOALS).optional().nullable(),
    topServices: z.array(z.string()).optional().nullable(),
    proofPoints: z.array(z.string()).optional().nullable(),
    tone: z.string().optional().nullable()
  })
  .optional()
  .nullable();

const CreateSchema = z.object({
  businessId: z.string().uuid(),
  businessName: z.string().min(1),
  industry: z.string().min(1),
  description: z.string().min(1),
  tone: ToneSchema,
  pagesMode: PagesModeSchema,
  templateId: z.string().optional().nullable(),
  primaryColor: ColorSchema,
  secondaryColor: ColorSchema,
  fontFamily: z.string().min(2).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  contact: ContactSchema,
  openingHours: z.string().optional().nullable(),
  socials: SocialsSchema,
  features: FeaturesSchema,
  hasOwnPhotos: z.boolean().optional(),
  contentLanguage: ContentLanguageSchema,
  generationBrief: GenerationBriefSchema
});

const UpdateSchema = z.object({
  siteId: z.string().uuid(),
  businessName: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  tone: ToneSchema,
  pagesMode: PagesModeSchema,
  templateId: z.string().optional().nullable(),
  primaryColor: ColorSchema,
  secondaryColor: ColorSchema,
  fontFamily: z.string().min(2).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  contact: ContactSchema,
  openingHours: z.string().optional().nullable(),
  socials: SocialsSchema,
  features: FeaturesSchema,
  hasOwnPhotos: z.boolean().optional(),
  contentLanguage: ContentLanguageSchema,
  generationBrief: GenerationBriefSchema
});

const getOwnedBusiness = async (admin: any, businessId: string, userId: string) => {
  const { data, error } = await (admin as any)
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .or(`owner_id.eq.${userId},owner_user_id.eq.${userId}`)
    .maybeSingle();

  if (error) {
    console.error("[BUILDER_BUSINESS_LOOKUP_ERROR]", error);
    return null;
  }

  return data as { id?: string } | null;
};

const getOwnedSite = async (admin: any, siteId: string, userId: string, select: string) => {
  const selectFields = new Set(
    select
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean)
  );
  selectFields.add("owner_user_id");
  selectFields.add("business_id");

  const { data, error } = await (admin as any)
    .from("builder_sites")
    .select(Array.from(selectFields).join(","))
    .eq("id", siteId)
    .maybeSingle();

  if (error) {
    console.error("[BUILDER_SITE_LOOKUP_ERROR]", error);
    return null;
  }

  const site = data as { owner_user_id?: string | null; business_id?: string | null } | null;
  if (!site) return null;

  if (site.owner_user_id === userId) {
    return data;
  }

  if (!site.business_id) {
    return null;
  }

  const business = await getOwnedBusiness(admin, site.business_id, userId);
  return business?.id ? data : null;
};


export async function GET(request: Request) {
  const supabase = getSupabaseRouteClient();
  const admin = getSupabaseServerAdminClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");

  const isValidUuid = siteId
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(siteId)
    : false;
  if (!siteId || !isValidUuid) {
    // Graceful response to avoid noisy 400s when localStorage contains invalid ids.
    return NextResponse.json({ id: null }, { status: 200 });
  }

  const site = await getOwnedSite(
    admin,
    siteId,
    userData.user.id,
    "id,business_id,status,template_key,template_id,tone,pages_mode,opening_hours,socials,has_own_photos,site_document,slug,path,primary_color,secondary_color,font_family,logo_url,business_name,industry,description,contact_email,contact_phone,contact_address,include_services,include_testimonials,include_pricing,include_faq,include_contact,include_reservation,include_gallery,content_language,generation_brief"
  );

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json(site);
}

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const admin = getSupabaseServerAdminClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

  const business = await getOwnedBusiness(admin, input.businessId, userData.user.id);

  if (!business?.id) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const templateId = selectTemplateId(input.industry, input.templateId);
  const templateKey = selectTemplateKey(input.industry, templateId);
  const baseSlug = slugify(input.businessName);
  const contentLanguage = input.contentLanguage ?? "en";
  const generationBrief = sanitizeGenerationBrief(
    input.generationBrief,
    input.tone ?? "professional"
  );

  let siteRow: { id?: string } | null = null;
  let insertError: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const slug = `${baseSlug}${suffix}`;
    const path = buildSitePath(slug);

    const result = await (admin as any)
      .from("builder_sites")
      .insert({
        business_id: input.businessId,
        owner_user_id: userData.user.id,
        status: "draft",
        slug,
        path,
        industry: input.industry,
        business_name: input.businessName,
        description: input.description,
        primary_color: input.primaryColor ?? null,
        secondary_color: input.secondaryColor ?? null,
        font_family: input.fontFamily ?? null,
        logo_url: input.logoUrl ?? null,
        contact_email: input.contact?.email ?? null,
        contact_phone: input.contact?.phone ?? null,
        contact_address: input.contact?.address ?? null,
        include_services: Boolean(input.features?.includeServices ?? true),
        include_testimonials: Boolean(input.features?.includeTestimonials),
        include_pricing: Boolean(input.features?.includePricing),
        include_faq: Boolean(input.features?.includeFaq),
        include_contact: Boolean(input.features?.includeContact ?? true),
        include_reservation: Boolean(input.features?.includeReservation),
        include_gallery: Boolean(input.features?.includeGallery),
        template_key: templateKey,
        template_id: templateId,
        tone: input.tone ?? null,
        pages_mode: input.pagesMode ?? "one",
        has_own_photos: Boolean(input.hasOwnPhotos),
        opening_hours: input.openingHours ?? null,
        socials: input.socials ?? null,
        content_language: contentLanguage,
        generation_brief: generationBrief
      })
      .select("id")
      .single();

    siteRow = result.data as { id?: string } | null;
    insertError = result.error;

    if (!insertError) {
      break;
    }

    if (insertError?.code !== "23505") {
      break;
    }
  }

  if (insertError || !siteRow?.id) {
    console.error("[BUILDER_CREATE_SITE_ERROR]", insertError);
    return NextResponse.json({ error: "Failed to create site" }, { status: 500 });
  }

  const includeMenu = input.industry.toLowerCase().includes("restaurant");
  const content = buildFallbackContent({
    businessName: input.businessName,
    industry: input.industry,
    description: input.description,
    primaryColor: input.primaryColor,
    logoUrl: input.logoUrl,
    contact: {
      email: input.contact?.email ?? null,
      phone: input.contact?.phone ?? null,
      address: input.contact?.address ?? null
    },
    features: {
      includeReservation: Boolean(input.features?.includeReservation),
      includeGallery: Boolean(input.features?.includeGallery),
      includeMenu
    },
    brief: generationBrief
  });

  const { seoTitle, seoDescription } = buildSeoFields({
    businessName: input.businessName,
    industry: input.industry,
    description: input.description,
    content
  });

  const { error: contentError } = await (admin as any)
    .from("builder_site_content")
    .insert({
      site_id: siteRow.id,
      business_id: input.businessId,
      content,
      seo_title: seoTitle,
      seo_description: seoDescription
    });

  if (contentError) {
    console.error("[BUILDER_CREATE_CONTENT_ERROR]", contentError);
    return NextResponse.json({ error: "Failed to create content" }, { status: 500 });
  }

  return NextResponse.json({
    siteId: siteRow.id,
    id: siteRow.id
  });
}

export async function PATCH(request: Request) {
  const supabase = getSupabaseRouteClient();
  const admin = getSupabaseServerAdminClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const updates: Record<string, unknown> = {};

  const existingSite = await getOwnedSite(admin, input.siteId, userData.user.id, "id");

  if (!existingSite?.id) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  if (input.businessName) updates.business_name = input.businessName;
  if (input.industry) {
    updates.industry = input.industry;
    const resolvedTemplateId = selectTemplateId(input.industry, input.templateId ?? null);
    updates.template_id = resolvedTemplateId;
    updates.template_key = selectTemplateKey(input.industry, resolvedTemplateId);
  }
  if (input.description) updates.description = input.description;
  if (input.tone !== undefined) updates.tone = input.tone;
  if (input.pagesMode !== undefined) updates.pages_mode = input.pagesMode;
  if (input.templateId !== undefined) {
    updates.template_id = input.templateId;
    updates.template_key = selectTemplateKey(
      input.industry ?? String(updates.industry ?? ""),
      input.templateId
    );
  }
  if (input.primaryColor !== undefined) updates.primary_color = input.primaryColor;
  if (input.secondaryColor !== undefined) updates.secondary_color = input.secondaryColor;
  if (input.fontFamily !== undefined) updates.font_family = input.fontFamily;
  if (input.logoUrl !== undefined) updates.logo_url = input.logoUrl;
  if (input.hasOwnPhotos !== undefined) updates.has_own_photos = input.hasOwnPhotos;
  if (input.openingHours !== undefined) updates.opening_hours = input.openingHours;
  if (input.socials !== undefined) updates.socials = input.socials;
  if (input.contentLanguage !== undefined) updates.content_language = input.contentLanguage ?? "en";
  if (input.generationBrief !== undefined) {
    updates.generation_brief = sanitizeGenerationBrief(
      input.generationBrief,
      input.tone ?? "professional"
    );
  }
  if (input.contact) {
    updates.contact_email = input.contact.email ?? null;
    updates.contact_phone = input.contact.phone ?? null;
    updates.contact_address = input.contact.address ?? null;
  }
  if (input.features) {
    if (input.features.includeServices !== undefined) {
      updates.include_services = input.features.includeServices;
    }
    if (input.features.includeTestimonials !== undefined) {
      updates.include_testimonials = input.features.includeTestimonials;
    }
    if (input.features.includePricing !== undefined) {
      updates.include_pricing = input.features.includePricing;
    }
    if (input.features.includeFaq !== undefined) {
      updates.include_faq = input.features.includeFaq;
    }
    if (input.features.includeContact !== undefined) {
      updates.include_contact = input.features.includeContact;
    }
    if (input.features.includeReservation !== undefined) {
      updates.include_reservation = input.features.includeReservation;
    }
    if (input.features.includeGallery !== undefined) {
      updates.include_gallery = input.features.includeGallery;
    }
  }

  const { error } = await (admin as any)
    .from("builder_sites")
    .update(updates)
    .eq("id", input.siteId);

  if (error) {
    console.error("[BUILDER_UPDATE_SITE_ERROR]", error);
    return NextResponse.json({ error: "Failed to update site" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
