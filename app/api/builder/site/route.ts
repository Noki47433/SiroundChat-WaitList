import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";
import { buildFallbackContent } from "@/lib/builder/ai";
import {
  CTA_GOALS,
  CONTENT_LANGUAGES,
  createEmptyGenerationBrief,
  sanitizeGenerationBrief
} from "@/lib/builder/generation-config";
import { buildSeoFields, buildSitePath, selectTemplateKey, slugify } from "@/lib/builder/utils";
import { ThemeStyleIdSchema, type ThemeStyleId } from "@/lib/builder/template-sites/schema";
import {
  isRestaurantStylePrompt,
  resolveRestaurantIntent,
  selectRestaurantTemplate
} from "@/lib/builder/template-sites/selection";

const INTEGRATED_TEMPLATE_IDS = [
  "evasion",
  "essence",
  "hously",
  "food-truck"
] as const;

const LEGACY_TEMPLATE_IDS = [
  "restaurant-editorial",
  "barbershop-editorial",
  "dental-assurance",
  "real-estate-signature",
  "clinic-clean",
  "beauty-lux",
  "corporate-sleek",
  "auto-modern",
  "home-services-trust",
  "legal-clarity",
  "portfolio-minimal",
  "ecommerce-simple",
  "hospitality-resort"
] as const;

const getSupportedExplicitTemplateId = (templateId?: string | null) => {
  const trimmed = (templateId ?? "").trim();
  if (!trimmed) return null;
  if (INTEGRATED_TEMPLATE_IDS.includes(trimmed as (typeof INTEGRATED_TEMPLATE_IDS)[number])) {
    return {
      templateId: trimmed,
      templateKind: "integrated" as const
    };
  }
  if (LEGACY_TEMPLATE_IDS.includes(trimmed as (typeof LEGACY_TEMPLATE_IDS)[number])) {
    return {
      templateId: trimmed,
      templateKind: "legacy" as const
    };
  }
  return null;
};

const selectTemplateId = (industry: string, templateId?: string | null) => {
  const explicit = getSupportedExplicitTemplateId(templateId);
  if (explicit) return explicit.templateId;
  const normalized = industry.toLowerCase();
  if (
    normalized.includes("restaurant") ||
    normalized.includes("cafe") ||
    normalized.includes("dining") ||
    normalized.includes("hospitality") ||
    normalized.includes("food & beverage") ||
    normalized.includes("food and beverage")
  ) {
    return "hously";
  }
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

const resolveTemplateSelection = (
  industry: string,
  description: string,
  templateId?: string | null,
  themeStyle?: ThemeStyleId | null,
  options?: {
    generationBrief?: {
      primaryCtaGoal?: string | null;
      coreOffer?: string | null;
      topServices?: string[] | null;
    } | null;
    features?: {
      includeReservation?: boolean;
      includeGallery?: boolean;
    } | null;
  },
  palette?: {
    primaryColor?: string | null;
    secondaryColor?: string | null;
  }
) => {
  const restaurantIntent = resolveRestaurantIntent({
    prompt: description,
    industry,
    templateId,
    generationBrief: options?.generationBrief ?? null,
    features: options?.features ?? null,
    services: options?.generationBrief?.topServices ?? null
  });
  const explicit = getSupportedExplicitTemplateId(templateId);
  if (restaurantIntent.isRestaurant) {
    const selected =
      explicit?.templateKind === "integrated"
        ? explicit.templateId
        : selectRestaurantTemplate(description, industry, themeStyle ?? null, palette).template;
    return {
      templateId: selected,
      templateKey: selected,
      routing: "integrated_restaurant" as const,
      restaurantIntent
    };
  }

  if (explicit) {
    return {
      templateId: explicit.templateId,
      templateKey:
        explicit.templateKind === "integrated"
          ? explicit.templateId
          : selectTemplateKey(industry, explicit.templateId),
      routing: explicit.templateKind === "integrated" ? ("integrated_explicit" as const) : ("legacy_explicit" as const),
      restaurantIntent
    };
  }

  if (isRestaurantStylePrompt(description, industry)) {
    const selected = selectRestaurantTemplate(description, industry, themeStyle ?? null, palette);
    return {
      templateId: selected.template,
      templateKey: selected.template,
      routing: "integrated_restaurant" as const,
      restaurantIntent
    };
  }

  const resolvedTemplateId = selectTemplateId(industry, templateId);
  return {
    templateId: resolvedTemplateId,
    templateKey: selectTemplateKey(industry, resolvedTemplateId),
    routing: "legacy_default" as const,
    restaurantIntent
  };
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
  themeStyle: ThemeStyleIdSchema.optional().nullable(),
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
  themeStyle: ThemeStyleIdSchema.optional().nullable(),
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
    .eq("launch_access", true)
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
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseServerAdminClientIfAvailable();
  if (!admin) {
    console.error("[BUILDER_SITE_GET_CONFIG_MISSING]", { userId: userData.user.id });
    return NextResponse.json({ error: "Builder is unavailable right now." }, { status: 500 });
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
    "id,business_id,status,template_key,template_id,tone,pages_mode,opening_hours,socials,has_own_photos,site_document,slug,path,primary_color,secondary_color,font_family,logo_url,business_name,industry,description,contact_email,contact_phone,contact_address,include_services,include_testimonials,include_pricing,include_faq,include_contact,include_reservation,include_gallery,content_language,generation_brief,published_url,updated_at"
  );

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const billingAccess = await getBusinessEntitlementAccess(site.business_id as string, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
  }

  return NextResponse.json(site);
}

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseServerAdminClientIfAvailable();
  if (!admin) {
    console.error("[BUILDER_SITE_POST_CONFIG_MISSING]", { userId: userData.user.id });
    return NextResponse.json({ error: "Builder is unavailable right now." }, { status: 500 });
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

  const billingAccess = await getBusinessEntitlementAccess(input.businessId, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
  }

  const templateSelection = resolveTemplateSelection(
    input.industry,
    input.description,
    input.templateId,
    input.themeStyle,
    {
      generationBrief: input.generationBrief ?? null,
      features: input.features ?? null
    },
    {
      primaryColor: input.primaryColor ?? null,
      secondaryColor: input.secondaryColor ?? null
    }
  );
  const templateId = templateSelection.templateId;
  const templateKey = templateSelection.templateKey;
  console.info("[BUILDER_SITE_TEMPLATE_SELECTION]", {
    businessId: input.businessId,
    industry: input.industry,
    routing: templateSelection.routing,
    templateId,
    templateKey,
    restaurantIntent: templateSelection.restaurantIntent.isRestaurant,
    restaurantSignals: templateSelection.restaurantIntent.matchedSignals
  });
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
    id: siteRow.id,
    templateId,
    templateKey
  });
}

export async function PATCH(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseServerAdminClientIfAvailable();
  if (!admin) {
    console.error("[BUILDER_SITE_PATCH_CONFIG_MISSING]", { userId: userData.user.id });
    return NextResponse.json({ error: "Builder is unavailable right now." }, { status: 500 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const updates: Record<string, unknown> = {};

  const existingSite = await getOwnedSite(admin, input.siteId, userData.user.id, "id,business_id");

  if (!existingSite?.id) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const billingAccess = await getBusinessEntitlementAccess(existingSite.business_id as string, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
  }

  if (input.businessName) updates.business_name = input.businessName;
  if (input.industry) {
    updates.industry = input.industry;
    const selection = resolveTemplateSelection(
      input.industry,
      input.description ?? "",
      input.templateId ?? null,
      input.themeStyle,
      {
        generationBrief: input.generationBrief ?? null,
        features: input.features ?? null
      },
      {
        primaryColor: input.primaryColor ?? null,
        secondaryColor: input.secondaryColor ?? null
      }
    );
    updates.template_id = selection.templateId;
    updates.template_key = selection.templateKey;
  }
  if (input.description) updates.description = input.description;
  if (input.tone !== undefined) updates.tone = input.tone;
  if (input.pagesMode !== undefined) updates.pages_mode = input.pagesMode;
  if (input.templateId !== undefined) {
    const selection = resolveTemplateSelection(
      input.industry ?? String(updates.industry ?? ""),
      input.description ?? "",
      input.templateId,
      input.themeStyle,
      {
        generationBrief: input.generationBrief ?? null,
        features: input.features ?? null
      },
      {
        primaryColor: input.primaryColor ?? null,
        secondaryColor: input.secondaryColor ?? null
      }
    );
    updates.template_id = selection.templateId;
    updates.template_key = selection.templateKey;
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

  if (updates.template_id || updates.template_key) {
    console.info("[BUILDER_SITE_TEMPLATE_UPDATE]", {
      siteId: input.siteId,
      industry: input.industry ?? null,
      templateId: updates.template_id ?? null,
      templateKey: updates.template_key ?? null
    });
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
