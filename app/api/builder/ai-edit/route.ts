import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { classifyEditIntent } from "@/lib/website-builder/ai/intent-classifier";
import { retrieveWebsiteKnowledge, buildDataSufficiencyCheck } from "@/lib/website-builder/ai/knowledge-retrieval";
import { buildSectionPatch } from "@/lib/builder/generation/patch";
import { getGenerationPolicy } from "@/lib/builder/generation/policy";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess,
} from "@/lib/server/billing-access";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import { buildTheme } from "@/lib/website-builder/editor/theme";
import type { SiteDocument, SiteSection, SitePage } from "@/lib/website-builder/types";
import { log } from "@/lib/utils/log";

export const runtime = "nodejs";

const PayloadSchema = z.object({
  siteId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(2000),
  pageId: z.string().optional(),
  sectionId: z.string().optional(),
});

type SiteRow = {
  id: string;
  business_id: string | null;
  business_name: string | null;
  industry: string | null;
  description: string | null;
  site_document: unknown;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  opening_hours: string | null;
  generation_brief: unknown;
};

const createSectionId = () => crypto.randomUUID();
const createPageId = () => crypto.randomUUID();

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);

const getActivePage = (document: SiteDocument, pageId?: string): SitePage | null => {
  if (pageId) {
    return document.pages.find((p) => p.id === pageId) ?? document.pages[0] ?? null;
  }
  return document.pages.find((p) => p.slug === "home" || p.slug === "/") ?? document.pages[0] ?? null;
};

async function applyContentEdit(
  document: SiteDocument,
  prompt: string,
  sectionHint: string | null | undefined,
  intake: { businessName: string; businessType: string; description: string },
  openai: NonNullable<ReturnType<typeof getOpenAIClient>>
): Promise<{ document: SiteDocument; summary: string }> {
  const policy = getGenerationPolicy(intake.businessType);

  const targetSectionTypes = sectionHint
    ? [sectionHint]
    : ["hero", "about", "services", "contact", "footer", "cta"];

  let changed = false;
  const changedSections: string[] = [];

  const updatedPages = await Promise.all(
    document.pages.map(async (page) => {
      const updatedSections = await Promise.all(
        page.sections.map(async (section) => {
          if (!targetSectionTypes.includes(section.type)) return section;

          const patchedContent = await buildSectionPatch(
            section,
            prompt,
            {
              businessName: intake.businessName,
              businessType: intake.businessType,
              subtype: null,
              location: null,
              services: [],
              toneProfile: "professional",
              ctaIntent: "contact",
              proofAssets: [],
              photosAvailable: false,
              description: intake.description,
            },
            policy,
            openai
          );

          if (patchedContent) {
            changed = true;
            changedSections.push(section.type);
            return { ...section, content: { ...section.content, ...patchedContent } };
          }
          return section;
        })
      );
      return { ...page, sections: updatedSections };
    })
  );

  const summary = changed
    ? `Updated ${[...new Set(changedSections)].join(", ")} section${changedSections.length > 1 ? "s" : ""}.`
    : "No changes were needed.";

  return { document: { ...document, pages: updatedPages }, summary };
}

async function applyThemeEdit(
  document: SiteDocument,
  prompt: string,
  openai: NonNullable<ReturnType<typeof getOpenAIClient>>
): Promise<{ document: SiteDocument; summary: string }> {
  const currentTheme = document.theme;
  const HEURISTICS: Array<{ terms: string[]; primary: string; bg: string; font?: string }> = [
    { terms: ["warm", "sunset", "cozy", "earthy"], primary: "#E07A5F", bg: "#FFFBF5" },
    { terms: ["luxury", "premium", "gold", "elegant", "dark gold"], primary: "#C9B37E", bg: "#0D0D0D", font: "Cormorant Garamond, Georgia, serif" },
    { terms: ["modern", "tech", "blue", "professional"], primary: "#2563EB", bg: "#FFFFFF" },
    { terms: ["minimal", "clean", "neutral", "white"], primary: "#111827", bg: "#FFFFFF" },
    { terms: ["green", "eco", "nature", "organic"], primary: "#16A34A", bg: "#F0FDF4" },
    { terms: ["purple", "violet", "lavender"], primary: "#7C3AED", bg: "#FAFAFA" },
    { terms: ["rose", "pink", "feminine", "blush"], primary: "#E11D48", bg: "#FFF1F2" },
  ];

  const lower = prompt.toLowerCase();
  let nextPrimary = currentTheme.primary;
  let nextBg = currentTheme.bg;
  let nextFont = currentTheme.fontBody;

  for (const heuristic of HEURISTICS) {
    if (heuristic.terms.some((t) => lower.includes(t))) {
      nextPrimary = heuristic.primary;
      nextBg = heuristic.bg;
      if (heuristic.font) nextFont = heuristic.font;
      break;
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You suggest website color themes. Return JSON only with: primary (hex), background (hex), fontFamily (css font stack or null)." },
        {
          role: "user",
          content: `Theme request: "${prompt}"\nCurrent primary: ${currentTheme.primary}\nCurrent background: ${currentTheme.bg}\n\nReturn JSON: { "primary": "#hex", "background": "#hex", "fontFamily": "..." or null }`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    if (parsed.primary && /^#[0-9a-fA-F]{3,6}$/.test(parsed.primary)) nextPrimary = parsed.primary;
    if (parsed.background && /^#[0-9a-fA-F]{3,6}$/.test(parsed.background)) nextBg = parsed.background;
    if (parsed.fontFamily && typeof parsed.fontFamily === "string") nextFont = parsed.fontFamily;
  } catch {
    // Use heuristic result
  }

  const nextTheme = buildTheme(nextPrimary, nextBg, nextFont ?? undefined);
  return {
    document: { ...document, theme: nextTheme },
    summary: "Theme updated.",
  };
}

async function generateSectionContent(
  sectionType: string,
  prompt: string,
  intake: { businessName: string; businessType: string; description: string },
  knowledgeText: string,
  openai: NonNullable<ReturnType<typeof getOpenAIClient>>
): Promise<Record<string, unknown>> {
  const hasKnowledge = knowledgeText.trim().length > 0;

  const systemPrompt = [
    "You generate website section content. Return JSON only.",
    hasKnowledge ? "Use ONLY the provided business data — do not invent items, prices, services, or facts." : "Create professional placeholder content.",
    `Business: ${intake.businessName} (${intake.businessType})`,
  ].join("\n");

  const userPrompt = [
    `Create content for a "${sectionType}" section.`,
    `Request: "${prompt}"`,
    hasKnowledge ? `\nBusiness data:\n${knowledgeText.slice(0, 3000)}` : "",
    `\nReturn JSON. Examples by type:`,
    `"services": {"title":"Our Services","items":[{"title":"Service Name","body":"Description"}]}`,
    `"testimonials": {"title":"What Clients Say","items":[{"quote":"Review text","name":"Name","role":"Role"}]}`,
    `"gallery": {"title":"Gallery","items":[{"src":"","alt":"Description"}]}`,
    `"pricing": {"title":"Pricing","plans":[{"name":"Plan","price":"$99","features":["Feature"]}]}`,
    `"faq": {"title":"FAQ","items":[{"question":"Q?","answer":"A."}]}`,
    `"cta": {"title":"Ready to start?","body":"Description","ctaLabel":"Contact Us","ctaHref":"#contact"}`,
    `"custom": {"title":"Section Title","body":"Section content"}`,
  ].join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: hasKnowledge ? 0.15 : 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    return JSON.parse(raw);
  } catch (error) {
    log("warn", "Section content generation failed", { error });
    return { title: sectionType.charAt(0).toUpperCase() + sectionType.slice(1), body: intake.businessName };
  }
}

const VALID_SECTION_TYPES = new Set([
  "hero", "about", "services", "testimonials", "gallery", "pricing", "faq",
  "cta", "contact", "footer", "reservation", "newsletter", "custom",
]);

const SECTION_TYPE_MAP: Record<string, string> = {
  "services": "services",
  "service": "services",
  "pricing": "pricing",
  "prices": "pricing",
  "price": "pricing",
  "gallery": "gallery",
  "photos": "gallery",
  "images": "gallery",
  "testimonials": "testimonials",
  "reviews": "testimonials",
  "faq": "faq",
  "faqs": "faq",
  "questions": "faq",
  "contact": "contact",
  "cta": "cta",
  "call to action": "cta",
  "about": "about",
  "hero": "hero",
  "reservation": "reservation",
  "booking": "reservation",
  "menu": "custom",
  "inventory": "custom",
  "listings": "custom",
  "rooms": "custom",
  "team": "custom",
};

const inferSectionType = (prompt: string, dataTypes: string[]): string => {
  const lower = prompt.toLowerCase();
  for (const [keyword, type] of Object.entries(SECTION_TYPE_MAP)) {
    if (lower.includes(keyword)) return type;
  }
  if (dataTypes.includes("service_data")) return "services";
  if (dataTypes.includes("menu_data")) return "custom";
  if (dataTypes.includes("pricing_data")) return "pricing";
  if (dataTypes.includes("property_data")) return "custom";
  if (dataTypes.includes("vehicle_data")) return "custom";
  return "custom";
};

function createSection(
  type: string,
  content: Record<string, unknown>,
  style?: Partial<SiteSection["style"]>
): SiteSection {
  const safeType = VALID_SECTION_TYPES.has(type) ? type : "custom";
  return {
    id: createSectionId(),
    type: safeType as SiteSection["type"],
    variant: "A",
    enabled: true,
    style: {
      alignment: "left",
      spacing: "normal",
      buttonStyle: "solid",
      background: { type: "plain" },
      ...style,
    },
    content,
    elements: [],
  };
}

async function buildKnowledgeBasedPage(
  pageName: string,
  prompt: string,
  intake: { businessName: string; businessType: string; description: string },
  knowledgeText: string,
  openai: NonNullable<ReturnType<typeof getOpenAIClient>>
): Promise<SitePage> {
  const hasKnowledge = knowledgeText.trim().length > 0;

  const planPrompt = [
    `Plan a website page called "${pageName}" for ${intake.businessName} (${intake.businessType}).`,
    hasKnowledge ? `Business data available:\n${knowledgeText.slice(0, 2000)}` : "No business data provided.",
    `Request: "${prompt}"`,
    `Return JSON: { "sections": [{"type": "<type>", "purpose": "<brief description>"}] }`,
    `Use 2-4 sections. Valid types: hero, services, pricing, gallery, testimonials, faq, cta, custom.`,
    `For menu/inventory/listings use type "custom".`,
  ].join("\n");

  let sectionPlan: Array<{ type: string; purpose: string }> = [
    { type: "hero", purpose: "Page header" },
    { type: "custom", purpose: "Main content" },
    { type: "cta", purpose: "Call to action" },
  ];

  try {
    const planCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You plan website page structures. Return JSON only." },
        { role: "user", content: planPrompt },
      ],
    });
    const raw = planCompletion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.sections) && parsed.sections.length >= 2) {
      sectionPlan = parsed.sections.slice(0, 4);
    }
  } catch (error) {
    log("warn", "Page plan generation failed, using default", { error });
  }

  const sectionsWithContent = await Promise.all(
    sectionPlan.map(async (plan) => {
      const content = await generateSectionContent(
        plan.type,
        `${plan.purpose}. Original request: ${prompt}`,
        intake,
        knowledgeText,
        openai
      );
      return createSection(plan.type, content);
    })
  );

  const slug = slugify(pageName);
  return {
    id: createPageId(),
    name: pageName,
    slug,
    showInMenu: true,
    menuTitle: pageName,
    order: 99,
    isSystem: false,
    sections: sectionsWithContent,
  };
}

async function persistDocument(siteId: string, document: SiteDocument): Promise<void> {
  const admin = getSupabaseServerAdminClient();
  const { error } = await (admin as any)
    .from("builder_sites")
    .update({ site_document: document, updated_at: new Date().toISOString() })
    .eq("id", siteId);
  if (error) {
    log("error", "Failed to persist document", { siteId, error });
    throw new Error("Failed to save document");
  }
}

export async function POST(request: Request) {
  const supabase = await getSupabaseRouteClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;

  const hasLaunchAccess = await userHasLaunchAccess(userId);
  if (!hasLaunchAccess) {
    return NextResponse.json({ error: "Access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const { siteId, prompt, pageId, sectionId } = parsed.data;

  const site = await getOwnedBuilderSite<SiteRow>(
    siteId,
    userId,
    "id,business_id,business_name,industry,description,site_document,contact_phone,contact_email,contact_address,opening_hours,generation_brief"
  );

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  if (site.business_id) {
    const billingAccess = await getBusinessEntitlementAccess(site.business_id, "website_builder");
    if (!billingAccess.allowed) {
      return buildUpgradeRequiredResponse("website_builder", billingAccess);
    }
  }

  const docParsed = SiteDocumentSchema.safeParse(site.site_document);
  if (!docParsed.success) {
    return NextResponse.json({ error: "Site document not available for this editor" }, { status: 400 });
  }
  const document = docParsed.data;

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  const businessType = site.industry ?? "other";
  const businessName = site.business_name ?? document.siteBrief?.businessName ?? "Business";
  const businessId = site.business_id ?? "";
  const existingPageNames = document.pages.map((p) => p.name);

  const classification = await classifyEditIntent({
    prompt,
    businessType,
    businessName,
    existingPageNames,
  });

  log("info", "[ai-edit] classified", { siteId, intent: classification.intent, route: classification.requiresKnowledge ? "kb" : "direct" });

  if (classification.intent === "unsupported_or_unsafe") {
    return NextResponse.json({
      ok: false,
      result: {
        type: "blocked",
        summary: "This request is outside what I can safely do.",
        clarification: {
          message: "I can't make that change. I only edit website content, structure, and design within safe bounds.",
        },
      },
    });
  }

  if (classification.intent === "full_regeneration") {
    return NextResponse.json({
      ok: false,
      result: {
        type: "redirect_to_generate",
        summary: "Full site regeneration requires the generate flow.",
        clarification: {
          message: "To fully regenerate your website, use the main generate button at the top of the editor.",
        },
      },
    });
  }

  let knowledgeText = "";
  let knowledgeDataSource = "";

  if (classification.requiresKnowledge && businessId) {
    const knowledgeResult = await retrieveWebsiteKnowledge({
      businessId,
      requiredKnowledge: classification.requiredKnowledge,
      prompt,
    });

    if (knowledgeResult.hasRelevantData) {
      knowledgeText = knowledgeResult.combinedText;
      knowledgeDataSource = "your business documents";
    } else {
      const sufficiency = buildDataSufficiencyCheck(
        classification.requiredKnowledge,
        knowledgeResult
      );
      if (!sufficiency.sufficient) {
        return NextResponse.json({
          ok: false,
          result: {
            type: "clarification_needed",
            summary: "More information needed.",
            clarification: {
              message: sufficiency.clarificationMessage,
              missingTypes: sufficiency.missingTypes,
            },
          },
        });
      }
    }
  }

  const intake = {
    businessName,
    businessType,
    description: site.description ?? document.siteBrief?.description ?? "",
  };

  try {
    let updatedDocument: SiteDocument = document;
    let summary = "";
    let resultType = "content_updated";

    switch (classification.intent) {
      case "content_edit":
      case "data_edit":
      case "seo_copy_edit": {
        const result = await applyContentEdit(
          document,
          prompt,
          classification.targetHint.sectionType,
          intake,
          openai
        );
        updatedDocument = result.document;
        summary = result.summary;
        resultType = "content_updated";
        break;
      }

      case "translation_edit": {
        const result = await applyContentEdit(
          document,
          `Translate all website text to match this instruction: ${prompt}`,
          null,
          intake,
          openai
        );
        updatedDocument = result.document;
        summary = "Content translated.";
        resultType = "content_updated";
        break;
      }

      case "theme_token_edit":
      case "style_refinement": {
        const result = await applyThemeEdit(document, prompt, openai);
        updatedDocument = result.document;
        summary = result.summary;
        resultType = "theme_updated";
        break;
      }

      case "navigation_edit": {
        const navPrompt = [
          "Update the website navigation based on this instruction.",
          `Instruction: ${prompt}`,
          `Current pages: ${document.pages.map((p) => `${p.name} (slug: ${p.slug})`).join(", ")}`,
          "Return JSON: { \"pages\": [{ \"id\": \"...\", \"menuTitle\": \"...\", \"showInMenu\": true/false }] }",
        ].join("\n");

        try {
          const navCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: "You update website navigation metadata. Return JSON only." },
              { role: "user", content: navPrompt },
            ],
          });
          const raw = navCompletion.choices[0]?.message?.content ?? "";
          const navPatch = JSON.parse(raw);
          if (Array.isArray(navPatch.pages)) {
            const navMap = new Map(
              navPatch.pages.map((p: { id: string; menuTitle?: string; showInMenu?: boolean }) => [p.id, p])
            );
            updatedDocument = {
              ...document,
              pages: document.pages.map((page) => {
                const patch = navMap.get(page.id) as { menuTitle?: string; showInMenu?: boolean } | undefined;
                if (!patch) return page;
                return {
                  ...page,
                  menuTitle: patch.menuTitle ?? page.menuTitle,
                  showInMenu: patch.showInMenu ?? page.showInMenu,
                };
              }),
            };
          }
        } catch (error) {
          log("warn", "Navigation edit AI failed", { error });
          updatedDocument = document;
        }
        summary = "Navigation updated.";
        resultType = "content_updated";
        break;
      }

      case "section_regeneration": {
        const activePage = getActivePage(document, pageId);
        const targetSection = activePage?.sections.find((s) => s.id === sectionId)
          ?? activePage?.sections.find((s) => s.type === (classification.targetHint.sectionType ?? "hero"));

        if (!targetSection || !activePage) {
          return NextResponse.json({
            ok: false,
            result: {
              type: "clarification_needed",
              clarification: { message: "Please select a section first, then try again." },
            },
          });
        }

        const policy = getGenerationPolicy(businessType);
        const patchedContent = await buildSectionPatch(
          targetSection,
          prompt,
          {
            businessName,
            businessType,
            subtype: null,
            location: null,
            services: [],
            toneProfile: "professional",
            ctaIntent: "contact",
            proofAssets: [],
            photosAvailable: false,
            description: intake.description,
          },
          policy,
          openai
        );

        if (patchedContent) {
          updatedDocument = {
            ...document,
            pages: document.pages.map((p) =>
              p.id !== activePage.id
                ? p
                : {
                    ...p,
                    sections: p.sections.map((s) =>
                      s.id !== targetSection.id ? s : { ...s, content: { ...s.content, ...patchedContent } }
                    ),
                  }
            ),
          };
          summary = `${targetSection.type} section regenerated.`;
        } else {
          summary = "No changes applied.";
        }
        resultType = "section_updated";
        break;
      }

      case "section_addition":
      case "knowledge_based_section_generation": {
        const sectionType = inferSectionType(prompt, classification.requiredKnowledge);
        const content = await generateSectionContent(
          sectionType,
          prompt,
          intake,
          knowledgeText,
          openai
        );
        const newSection = createSection(sectionType, content);
        const activePage = getActivePage(document, pageId);

        if (!activePage) {
          return NextResponse.json({ error: "No page found" }, { status: 400 });
        }

        const insertAfterIndex = sectionId
          ? Math.max(0, activePage.sections.findIndex((s) => s.id === sectionId) + 1)
          : activePage.sections.length - 1;

        const newSections = [...activePage.sections];
        newSections.splice(insertAfterIndex, 0, newSection);

        updatedDocument = {
          ...document,
          pages: document.pages.map((p) =>
            p.id !== activePage.id ? p : { ...p, sections: newSections }
          ),
        };

        summary = `${sectionType} section added${knowledgeDataSource ? ` using ${knowledgeDataSource}` : ""}.`;
        resultType = "section_added";
        break;
      }

      case "page_addition":
      case "knowledge_based_page_generation": {
        const pageNameMatch = prompt.match(/(?:add|create|build|make)\s+(?:a\s+)?(.+?)\s+page/i);
        const pageName = pageNameMatch
          ? pageNameMatch[1].replace(/\b\w/g, (c) => c.toUpperCase()).trim()
          : "New Page";

        const existingSlugs = new Set(document.pages.map((p) => p.slug));
        let candidateSlug = slugify(pageName);
        let attempt = 0;
        while (existingSlugs.has(candidateSlug) && attempt < 5) {
          attempt++;
          candidateSlug = `${slugify(pageName)}-${attempt}`;
        }

        const newPage = await buildKnowledgeBasedPage(
          pageName,
          prompt,
          intake,
          knowledgeText,
          openai
        );
        newPage.slug = candidateSlug;
        newPage.order = document.pages.length;

        updatedDocument = {
          ...document,
          pages: [...document.pages, newPage],
        };

        summary = `"${pageName}" page added${knowledgeDataSource ? ` using ${knowledgeDataSource}` : ""}.`;
        resultType = "page_added";
        break;
      }

      default: {
        const result = await applyContentEdit(document, prompt, null, intake, openai);
        updatedDocument = result.document;
        summary = result.summary;
        resultType = "content_updated";
      }
    }

    await persistDocument(siteId, updatedDocument);

    return NextResponse.json({
      ok: true,
      result: {
        type: resultType,
        document: updatedDocument,
        summary,
        dataSource: knowledgeDataSource || null,
        intent: classification.intent,
      },
    });
  } catch (error) {
    log("error", "[ai-edit] execution failed", { siteId, intent: classification.intent, error });
    return NextResponse.json(
      { error: "AI edit failed. Please try again." },
      { status: 500 }
    );
  }
}
