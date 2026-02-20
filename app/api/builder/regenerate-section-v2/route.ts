import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/ai/client";
import { getBuilderPlanForRoute } from "@/lib/builder/plan";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import type { SiteDocument, SiteSection } from "@/lib/website-builder/types";

export const runtime = "nodejs";

const SectionTypeSchema = z.enum([
  "hero",
  "services",
  "about",
  "gallery",
  "testimonials",
  "pricing",
  "cta",
  "faq",
  "contact",
  "reservation",
  "footer",
  "newsletter",
  "blog-index",
  "blog-post",
  "store-listing",
  "store-product",
  "store-cart",
  "custom",
  "app-embed"
]);

const PayloadSchema = z
  .object({
    siteId: z.string().uuid(),
    sectionId: z.string().optional(),
    sectionType: SectionTypeSchema.optional(),
    prompt: z.string().optional().nullable()
  })
  .refine((value) => Boolean(value.sectionId || value.sectionType), {
    message: "sectionId or sectionType required"
  });

const DEFAULT_CONTENT_BY_TYPE: Record<SiteSection["type"], Record<string, any>> = {
  hero: {
    headline: "Headline",
    subheadline: "Add a short description to introduce the business.",
    ctaLabel: "Get started",
    ctaHref: "#contact"
  },
  services: {
    title: "Services",
    items: [
      { title: "Service one", body: "Describe the service in one sentence." },
      { title: "Service two", body: "Describe the service in one sentence." },
      { title: "Service three", body: "Describe the service in one sentence." }
    ]
  },
  about: {
    title: "About",
    body: "Share the story behind this business and what makes it special."
  },
  gallery: {
    title: "Gallery"
  },
  testimonials: {
    title: "Testimonials",
    items: [
      { quote: "Client quote goes here.", name: "Alex Lee", role: "Client" },
      { quote: "Another highlight from a client.", name: "Jamie Park", role: "Client" }
    ]
  },
  pricing: {
    title: "Pricing",
    plans: [
      { name: "Starter", price: "$99", description: "Perfect for essentials.", features: [] },
      { name: "Growth", price: "$199", description: "Best for teams.", features: [] }
    ]
  },
  cta: {
    title: "Ready to start?",
    body: "Tell us about your goals and we will follow up quickly.",
    ctaLabel: "Book a call",
    ctaHref: "#contact"
  },
  faq: {
    title: "FAQ",
    items: [
      { question: "Common question", answer: "Provide a short answer." },
      { question: "Another question", answer: "Provide a short answer." }
    ]
  },
  contact: {
    title: "Contact",
    body: "Share how customers can reach you.",
    email: "",
    phone: "",
    address: ""
  },
  reservation: {
    title: "Reservations",
    body: "Invite customers to book a reservation."
  },
  footer: {
    text: "© Your business. All rights reserved."
  },
  newsletter: {
    title: "Join our newsletter",
    body: "Stay in the loop with updates, launches, and tips.",
    ctaLabel: "Subscribe"
  },
  "blog-index": {
    title: "Blog",
    body: "Latest news and insights from the team.",
    posts: []
  },
  "blog-post": {
    title: "Blog post title",
    body: "Write the post content here.",
    date: ""
  },
  "store-listing": {
    title: "Shop",
    body: "Browse our featured products.",
    products: []
  },
  "store-product": {
    title: "Featured product",
    body: "Highlight the product details and benefits here.",
    price: ""
  },
  "store-cart": {
    title: "Your cart"
  },
  custom: {
    title: "Custom section",
    body: "Add your own elements and layout."
  },
  "app-embed": {
    title: "App widget",
    body: "Configure this app in the Apps panel to finish setup."
  }
};

const normalizeSectionContent = (
  type: SiteSection["type"],
  existing: Record<string, any>,
  generated: Record<string, any> | null
) => {
  const fallback = DEFAULT_CONTENT_BY_TYPE[type] ?? {};
  const merged = { ...fallback, ...existing, ...(generated ?? {}) } as Record<string, any>;

  if (type === "services") {
    merged.items = Array.isArray(merged.items) ? merged.items : fallback.items ?? [];
  }
  if (type === "testimonials") {
    merged.items = Array.isArray(merged.items) ? merged.items : fallback.items ?? [];
  }
  if (type === "pricing") {
    merged.plans = Array.isArray(merged.plans) ? merged.plans : fallback.plans ?? [];
  }
  if (type === "faq") {
    merged.items = Array.isArray(merged.items) ? merged.items : fallback.items ?? [];
  }
  if (type === "blog-index") {
    merged.posts = Array.isArray(merged.posts) ? merged.posts : fallback.posts ?? [];
  }
  if (type === "store-listing") {
    merged.products = Array.isArray(merged.products) ? merged.products : fallback.products ?? [];
  }

  return merged;
};

const getSchemaHint = (type: SiteSection["type"]) => {
  switch (type) {
    case "hero":
      return '{"headline":"...","subheadline":"...","ctaLabel":"...","ctaHref":"#contact"}';
    case "about":
      return '{"title":"...","body":"..."}';
    case "services":
      return '{"title":"...","items":[{"title":"...","body":"..."}]}';
    case "testimonials":
      return '{"title":"...","items":[{"quote":"...","name":"...","role":"..."}]}';
    case "pricing":
      return '{"title":"...","plans":[{"name":"...","price":"...","description":"..."}]}';
    case "cta":
      return '{"title":"...","body":"...","ctaLabel":"...","ctaHref":"#contact"}';
    case "faq":
      return '{"title":"...","items":[{"question":"...","answer":"..."}]}';
    case "contact":
      return '{"title":"...","body":"...","email":"...","phone":"...","address":"..."}';
    case "reservation":
      return '{"title":"...","body":"..."}';
    case "footer":
      return '{"text":"..."}';
    case "gallery":
      return '{"title":"..."}';
    default:
      return JSON.stringify(DEFAULT_CONTENT_BY_TYPE[type] ?? {});
  }
};

async function runCompletionWithTimeout(openai: any, message: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return JSON only. No markdown." },
          { role: "user", content: message }
        ]
      },
      { signal: controller.signal } as any
    );

    return completion.choices[0]?.message?.content ?? "";
  } catch (err: any) {
    const messageText = String(err?.message ?? "").toLowerCase();
    const isAbort =
      err?.name === "AbortError" ||
      messageText.includes("aborted") ||
      messageText.includes("abort");
    if (isAbort) {
      const e = new Error("OPENAI_TIMEOUT_ABORT");
      (e as any).cause = err;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

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

  const { siteId, sectionId, sectionType, prompt } = parsed.data;

  const { data: site } = await (supabase as any)
    .from("builder_sites")
    .select(
      "id,business_id,site_document,business_name,industry,description,primary_color,secondary_color,font_family,logo_url"
    )
    .eq("id", siteId)
    .maybeSingle();

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

  const businessName = document.siteBrief?.businessName ?? site.business_name ?? "the business";
  const industry = document.siteBrief?.industry ?? site.industry ?? "";
  const description = document.siteBrief?.description ?? site.description ?? "";
  const tone = document.siteBrief?.tone ?? document.tone ?? "professional";

  const promptLines = [
    "You are regenerating copy for a website section.",
    `Section type: ${targetSection.type}.`,
    `Business: ${businessName}.`,
    industry ? `Industry: ${industry}.` : null,
    description ? `Description: ${description}.` : null,
    tone ? `Tone: ${tone}.` : null,
    prompt ? `User request: ${prompt}` : null,
    "Return JSON only with the exact keys required for this section.",
    `Output shape example: ${getSchemaHint(targetSection.type)}`,
    `Current content: ${JSON.stringify(targetSection.content ?? {})}`
  ].filter(Boolean);

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });
  }

  const OPENAI_TIMEOUT_MS = 60000;

  let raw = "";
  try {
    raw = await runCompletionWithTimeout(openai, promptLines.join("\n"), OPENAI_TIMEOUT_MS);
  } catch (err: any) {
    if (err?.message === "OPENAI_TIMEOUT_ABORT") {
      return NextResponse.json({ error: "OpenAI request timed out" }, { status: 500 });
    }
    console.error("[BUILDER_REGENERATE_V2_ERROR]", err);
    return NextResponse.json({ error: "OpenAI request failed" }, { status: 500 });
  }

  let generated: Record<string, any> | null = null;
  try {
    generated = raw ? (JSON.parse(raw) as Record<string, any>) : null;
  } catch (error) {
    console.error("[BUILDER_REGENERATE_V2_PARSE]", error);
    generated = null;
  }

  const nextContent = normalizeSectionContent(targetSection.type, targetSection.content ?? {}, generated);

  const nextDocument: SiteDocument = {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.id === targetSection.id ? { ...section, content: nextContent } : section
      )
    }))
  };

  const validated = SiteDocumentSchema.safeParse(nextDocument);
  if (!validated.success) {
    console.error("[BUILDER_REGENERATE_V2_VALIDATION]", validated.error.flatten());
    return NextResponse.json({ error: "Regenerated content invalid" }, { status: 500 });
  }

  const { error: updateError } = await (supabase as any)
    .from("builder_sites")
    .update({ site_document: validated.data })
    .eq("id", siteId);

  if (updateError) {
    console.error("[BUILDER_REGENERATE_V2_SAVE]", updateError);
    return NextResponse.json({ error: "Failed to save content" }, { status: 500 });
  }

  const updatedSection = validated.data.pages
    .flatMap((page) => page.sections)
    .find((section) => section.id === targetSection.id);

  return NextResponse.json({ section: updatedSection ?? null });
}
