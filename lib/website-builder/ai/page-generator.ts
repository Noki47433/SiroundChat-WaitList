import { getOpenAIClient } from "@/lib/ai/client";
import {
  IntegratedPageBlockSchema,
  IntegratedTemplatePageSchema,
  type IntegratedPageBlock,
  type IntegratedPageKind,
  type IntegratedTemplatePage
} from "@/lib/builder/template-sites/schema";
import { normalizePageSlug } from "@/lib/builder/template-sites/nav-inject";

const PAGE_SHAPE_GUIDE = `
{
  "title": "string — page title shown in browser tab and page hero",
  "slug": "string — lowercase, hyphens only, e.g. 'menu', 'our-services', 'property-listings'",
  "kind": "menu | services | pricing | gallery | faq | property_listings | car_inventory | rooms | custom",
  "metaDescription": "string — under 160 chars, used for SEO",
  "navigationLabel": "string — short nav label, 1-3 words, e.g. 'Menu', 'Services', 'Properties'",
  "blocks": [
    {
      "id": "block-1",
      "kind": "hero",
      "enabled": true,
      "content": { "heading": "string", "subheading": "string", "ctaLabel": "string (optional)", "ctaHref": "string (optional)" }
    }
  ]
}

Block kinds and their required content fields:
- hero:           { heading, subheading, ctaLabel?, ctaHref? }
- text:           { heading?, body }
- menu_grid:      { heading?, categories: [{ id, label, items: [{ title, description?, price? }] }] }
- service_cards:  { heading?, items: [{ title, description, price? }] }
- gallery_grid:   { heading?, note? }
- faq_list:       { heading?, items: [{ question, answer }] }
- cta:            { heading, body?, ctaLabel, ctaHref }
- contact:        { heading?, phone?, email?, addressLines?, hours? }
- property_cards: { heading?, items: [{ title, description, price?, location?, beds?, baths? }] }
- car_cards:      { heading?, items: [{ title, year?, price?, description?, mileage? }] }
- room_cards:     { heading?, items: [{ title, description, price?, amenities? }] }

Rules:
- Return 3-6 blocks total
- The first block must be "hero"
- Use ONLY information from the provided knowledge context — never invent prices, items, dishes, properties, vehicles, or services
- For menu pages: use real categories and items from knowledge context
- For FAQ: may write operational FAQs grounded in the provided business info
- For gallery pages: just include a hero and gallery_grid block (content field can be minimal)
- Keep headings concise, brand-appropriate, and guest-facing
- The last block should be "cta" or "contact" where appropriate
`.trim();

export type GeneratedPageResult = {
  title: string;
  slug: string;
  kind: IntegratedPageKind;
  metaDescription: string;
  navigationLabel: string;
  blocks: IntegratedPageBlock[];
};

function safeParseBlocks(raw: unknown): IntegratedPageBlock[] {
  if (!Array.isArray(raw)) return [];
  const results: IntegratedPageBlock[] = [];
  for (const item of raw) {
    const parsed = IntegratedPageBlockSchema.safeParse(item);
    if (parsed.success) {
      results.push(parsed.data);
    }
  }
  return results;
}

function inferKind(prompt: string, slug: string): IntegratedPageKind {
  const text = `${prompt} ${slug}`.toLowerCase();
  if (/menu|dish|food|cuisine|item/.test(text)) return "menu";
  if (/service|treatment|procedure|offering/.test(text)) return "services";
  if (/pric|price|pricing|plan|package/.test(text)) return "pricing";
  if (/gallery|photo|image|picture/.test(text)) return "gallery";
  if (/faq|question|answer/.test(text)) return "faq";
  if (/propert|listing|home|house|apartment|estate/.test(text)) return "property_listings";
  if (/car|vehicle|inventory|auto|truck|suv/.test(text)) return "car_inventory";
  if (/room|suite|accommodation|stay/.test(text)) return "rooms";
  return "custom";
}

export async function generateIntegratedPage(params: {
  prompt: string;
  businessName: string;
  businessType: string;
  template: string;
  knowledgeContext: string | null;
  existingSlugs: string[];
}): Promise<GeneratedPageResult | null> {
  const openai = getOpenAIClient();
  if (!openai) return null;

  const systemPrompt = [
    "You are a website page generator for a business.",
    "Generate a structured page as valid JSON.",
    "Follow the page shape guide exactly.",
    "Use ONLY information from the business knowledge context.",
    "Never invent fake menu items, prices, services, properties, vehicles, or reviews.",
    "Return ONLY the JSON object, no markdown, no code fences."
  ].join(" ");

  const userContent = [
    `Business name: ${params.businessName}`,
    `Business type: ${params.businessType}`,
    `Template style: ${params.template}`,
    `User request: ${params.prompt}`,
    params.knowledgeContext
      ? `\nBusiness knowledge from documents:\n${params.knowledgeContext}`
      : "\nNote: No business documents found — use only general operational information and leave item/price fields empty.",
    "\nGenerate the page JSON using this shape:\n",
    PAGE_SHAPE_GUIDE
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ]
    });

    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

    const rawSlug = typeof raw.slug === "string" ? raw.slug : params.prompt.toLowerCase().replace(/\s+/g, "-");
    const slug = normalizePageSlug(rawSlug, params.existingSlugs);
    const kind: IntegratedPageKind = IntegratedTemplatePageSchema.shape.kind.safeParse(raw.kind).success
      ? (raw.kind as IntegratedPageKind)
      : inferKind(params.prompt, slug);

    const blocks = safeParseBlocks(raw.blocks);
    if (!blocks.length) return null;

    return {
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : params.prompt,
      slug,
      kind,
      metaDescription:
        typeof raw.metaDescription === "string" && raw.metaDescription.trim()
          ? raw.metaDescription.trim().slice(0, 160)
          : `${params.businessName} — ${typeof raw.title === "string" ? raw.title : slug}`,
      navigationLabel:
        typeof raw.navigationLabel === "string" && raw.navigationLabel.trim()
          ? raw.navigationLabel.trim().slice(0, 24)
          : (typeof raw.title === "string" ? raw.title.split(" ")[0] : slug),
      blocks
    };
  } catch (err) {
    console.error("[PAGE_GENERATOR_ERROR]", err);
    return null;
  }
}
