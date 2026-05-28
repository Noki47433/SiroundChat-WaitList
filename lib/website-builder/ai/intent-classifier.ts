import { getOpenAIClient } from "@/lib/ai/client";
import { log } from "@/lib/utils/log";

export const EDIT_INTENT_TYPES = [
  "content_edit",
  "data_edit",
  "seo_copy_edit",
  "translation_edit",
  "theme_token_edit",
  "style_refinement",
  "section_addition",
  "section_regeneration",
  "page_addition",
  "navigation_edit",
  "full_regeneration",
  "knowledge_based_page_generation",
  "knowledge_based_section_generation",
  "unsupported_or_unsafe",
] as const;

export type EditIntentType = (typeof EDIT_INTENT_TYPES)[number];

export const KNOWLEDGE_DATA_TYPES = [
  "menu_data",
  "service_data",
  "property_data",
  "vehicle_data",
  "room_data",
  "team_data",
  "pricing_data",
  "faq_data",
  "opening_hours_data",
] as const;

export type KnowledgeDataType = (typeof KNOWLEDGE_DATA_TYPES)[number];

export type ClassifiedEditIntent = {
  intent: EditIntentType;
  confidence: number;
  requiresKnowledge: boolean;
  requiredKnowledge: KnowledgeDataType[];
  targetHint: {
    pageSlug?: string | null;
    sectionType?: string | null;
    field?: string | null;
  };
  reasoning: string;
};

const INTENT_DEFINITIONS = `
content_edit: Change specific text/copy inside existing structure. Examples: change hero title, rewrite CTA, update paragraph, rewrite bio.
data_edit: Change structured factual data. Examples: update phone, update opening hours, update address, change prices in existing section.
seo_copy_edit: Improve meta title, meta description, or rewrite a section for SEO purposes.
translation_edit: Translate existing content to another language without changing structure.
theme_token_edit: Change colors, fonts, button styles, or visual tokens. Examples: make primary color purple, change font, make background darker.
style_refinement: Improve the visual quality/feel of the site. Examples: make homepage feel luxury, make cards more elegant, improve spacing.
section_addition: Add a new section to an existing page. Examples: add testimonials, add gallery, add FAQ, add opening hours section.
section_regeneration: Redesign or regenerate one existing section. Examples: redesign hero, remake testimonials section.
page_addition: Add a new page. Examples: add contact page, add gallery page, add about page, add services page.
navigation_edit: Add/rename/reorder navigation items. Examples: rename Contact to Visit Us, add Services to nav.
full_regeneration: Rebuild or fully remake the website. Examples: remake entire website, create new design from scratch.
knowledge_based_page_generation: Add a page whose core content MUST come from real business data (menu, services, listings, inventory). Examples: add menu page, add property listings page, add car inventory page, add dental services page, add hotel rooms page.
knowledge_based_section_generation: Add a section whose content MUST come from real business data. Examples: add menu preview section, add services grid with prices, add vehicle highlights.
unsupported_or_unsafe: Request is unclear, dangerous, irrelevant, or outside scope. Examples: delete everything, add malicious code, fake reviews, inject scripts.
`.trim();

const KNOWLEDGE_TYPE_DEFINITIONS = `
menu_data: Needed for menu pages/sections (dishes, categories, prices, descriptions).
service_data: Needed for services pages/sections (treatments, procedures, packages, prices).
property_data: Needed for property listing pages (addresses, prices, bedrooms, features).
vehicle_data: Needed for car inventory pages (model, year, mileage, price, features).
room_data: Needed for hotel room pages (room types, amenities, prices).
team_data: Needed for team/staff pages (names, roles, bios).
pricing_data: Needed when generating pricing tables from real data.
faq_data: Needed when generating FAQ sections from real business FAQs.
opening_hours_data: Needed when updating or adding opening hours.
`.trim();

const SYSTEM_PROMPT = `You are an AI that classifies website edit requests into structured intents. Return JSON only.

INTENT TYPES:
${INTENT_DEFINITIONS}

KNOWLEDGE DATA TYPES (only include when page/section generation requires real factual business data):
${KNOWLEDGE_TYPE_DEFINITIONS}

Rules:
- knowledge_based_page_generation and knowledge_based_section_generation are for requests that NEED real business data (menu items, service list, property listings, vehicle inventory, team members). Always include the appropriate requiredKnowledge array for these.
- page_addition is for pages that don't strictly need factual data (e.g., "add contact page", "add gallery page").
- content_edit and data_edit routes do NOT require knowledge unless the content depends on uploaded documents.
- Do NOT return knowledge_based for theme, style, or structural layout requests.
- unsupported_or_unsafe for: fake content, malicious code, accessing other businesses, deleting without confirmation.`;

const buildUserPrompt = (
  prompt: string,
  businessType: string,
  existingPageNames: string[],
  businessName: string
) => `
Business: ${businessName} (${businessType})
Existing pages: ${existingPageNames.length ? existingPageNames.join(", ") : "none"}

User request: "${prompt}"

Classify this request. Return JSON:
{
  "intent": "<one of the intent types>",
  "confidence": <0.0-1.0>,
  "requiresKnowledge": <true|false>,
  "requiredKnowledge": ["<knowledge data types if any>"],
  "targetHint": {
    "pageSlug": "<slug if targeting specific page, or null>",
    "sectionType": "<section type if targeting specific section, or null>",
    "field": "<specific field if targeting a field, or null>"
  },
  "reasoning": "<brief one-sentence reasoning>"
}
`.trim();

const KEYWORD_FALLBACK_MAP: Array<{
  keywords: string[];
  intent: EditIntentType;
  requiredKnowledge: KnowledgeDataType[];
}> = [
  { keywords: ["translate", "translation", "language", "albanian", "bilingual"], intent: "translation_edit", requiredKnowledge: [] },
  { keywords: ["color", "palette", "theme", "font", "typography", "background color", "primary color", "dark mode"], intent: "theme_token_edit", requiredKnowledge: [] },
  { keywords: ["luxury", "elegant", "premium", "modern", "clean", "redesign", "feel more"], intent: "style_refinement", requiredKnowledge: [] },
  { keywords: ["seo", "meta title", "meta description", "keyword", "search engine"], intent: "seo_copy_edit", requiredKnowledge: [] },
  { keywords: ["add menu page", "menu page", "food page", "dish page"], intent: "knowledge_based_page_generation", requiredKnowledge: ["menu_data"] },
  { keywords: ["add services page", "services page", "treatments page", "pricing page"], intent: "knowledge_based_page_generation", requiredKnowledge: ["service_data", "pricing_data"] },
  { keywords: ["inventory page", "car page", "vehicle page", "cars page"], intent: "knowledge_based_page_generation", requiredKnowledge: ["vehicle_data"] },
  { keywords: ["property page", "listings page", "real estate page", "properties page", "apartments page"], intent: "knowledge_based_page_generation", requiredKnowledge: ["property_data"] },
  { keywords: ["rooms page", "hotel rooms", "suite page"], intent: "knowledge_based_page_generation", requiredKnowledge: ["room_data"] },
  { keywords: ["menu section", "add menu", "show menu", "dishes section"], intent: "knowledge_based_section_generation", requiredKnowledge: ["menu_data"] },
  { keywords: ["add testimonials", "add reviews", "testimonials section"], intent: "section_addition", requiredKnowledge: [] },
  { keywords: ["add gallery", "gallery section", "photo section", "image section"], intent: "section_addition", requiredKnowledge: [] },
  { keywords: ["add faq", "faq section", "questions section"], intent: "section_addition", requiredKnowledge: [] },
  { keywords: ["add page", "new page", "create page"], intent: "page_addition", requiredKnowledge: [] },
  { keywords: ["remake site", "rebuild site", "new design", "full redesign", "start over", "completely redesign"], intent: "full_regeneration", requiredKnowledge: [] },
  { keywords: ["opening hours", "hours", "phone number", "address", "email", "prices", "update price"], intent: "data_edit", requiredKnowledge: [] },
  { keywords: ["nav", "navigation", "navbar", "menu item", "rename page"], intent: "navigation_edit", requiredKnowledge: [] },
];

const keywordFallback = (prompt: string): ClassifiedEditIntent => {
  const normalized = prompt.toLowerCase();
  for (const { keywords, intent, requiredKnowledge } of KEYWORD_FALLBACK_MAP) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return {
        intent,
        confidence: 0.6,
        requiresKnowledge: requiredKnowledge.length > 0,
        requiredKnowledge,
        targetHint: {},
        reasoning: `Keyword match for "${intent}"`,
      };
    }
  }
  return {
    intent: "content_edit",
    confidence: 0.5,
    requiresKnowledge: false,
    requiredKnowledge: [],
    targetHint: {},
    reasoning: "Default: treating as content edit",
  };
};

export async function classifyEditIntent(params: {
  prompt: string;
  businessType: string;
  businessName: string;
  existingPageNames: string[];
}): Promise<ClassifiedEditIntent> {
  const { prompt, businessType, businessName, existingPageNames } = params;

  const openai = getOpenAIClient();
  if (!openai) {
    log("warn", "OPENAI_API_KEY missing, using keyword fallback for intent classification");
    return keywordFallback(prompt);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(prompt, businessType, existingPageNames, businessName) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);

    const intent = EDIT_INTENT_TYPES.includes(parsed.intent) ? parsed.intent as EditIntentType : "content_edit";
    const requiredKnowledge: KnowledgeDataType[] = Array.isArray(parsed.requiredKnowledge)
      ? (parsed.requiredKnowledge as string[]).filter((k): k is KnowledgeDataType => KNOWLEDGE_DATA_TYPES.includes(k as KnowledgeDataType))
      : [];

    return {
      intent,
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.7,
      requiresKnowledge: Boolean(parsed.requiresKnowledge) || requiredKnowledge.length > 0,
      requiredKnowledge,
      targetHint: {
        pageSlug: typeof parsed.targetHint?.pageSlug === "string" ? parsed.targetHint.pageSlug : null,
        sectionType: typeof parsed.targetHint?.sectionType === "string" ? parsed.targetHint.sectionType : null,
        field: typeof parsed.targetHint?.field === "string" ? parsed.targetHint.field : null,
      },
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    };
  } catch (error) {
    log("warn", "Intent classification AI failed, using keyword fallback", { error });
    return keywordFallback(prompt);
  }
}
