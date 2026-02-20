import { getOpenAIClient } from "@/lib/ai/client";
import { log } from "@/lib/utils/log";
import { SiteContentSchema, type SectionKey, type SiteContent } from "@/lib/builder/types";

type GenerationInput = {
  businessName: string;
  industry: string;
  description: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
  contact?: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  features?: {
    includeReservation?: boolean;
    includeGallery?: boolean;
    includeMenu?: boolean;
  };
};

const SYSTEM_PROMPT =
  "You generate website copy. Return JSON only. No markdown. No commentary. Follow the schema exactly.";

const buildSchemaPrompt = () => [
  "Schema:",
  "{",
  "  hero: { headline: string, subheadline: string, ctaLabel: string, ctaHref: string },",
  "  about: { title: string, body: string },",
  "  services: { title: string, items: Array<{ title: string, body: string }> },",
  "  gallery?: { title: string, images: Array<{ url: string, alt: string }> },",
  "  menu?: { title: string, items: Array<{ name: string, description: string, price?: string }> },",
  "  reservation?: { enabled: boolean, title: string, description: string },",
  "  contact: { title: string, body: string, email?: string, phone?: string, address?: string },",
  "  footer: { text: string }",
  "}"
].join("\n");

const buildPrompt = (input: GenerationInput) => {
  const includeReservation = Boolean(input.features?.includeReservation);
  const includeGallery = Boolean(input.features?.includeGallery);
  const includeMenu = Boolean(input.features?.includeMenu);

  return [
    "Generate website content in JSON only.",
    "Keep tone industry-specific and confident.",
    "Services.items max 6.",
    "Use short, clear sentences.",
    "ctaHref should be '#contact' unless a better fit is obvious.",
    includeReservation
      ? "Include reservation with enabled: true and encourage booking."
      : "Do not include reservation section.",
    includeGallery ? "Include gallery section with 3-6 images." : "Do not include gallery section.",
    includeMenu ? "Include menu section." : "Do not include menu section.",
    `businessName: ${input.businessName}`,
    `industry: ${input.industry}`,
    `description: ${input.description}`,
    `primaryColor: ${input.primaryColor ?? ""}`,
    `logoUrl: ${input.logoUrl ?? ""}`,
    `contactEmail: ${input.contact?.email ?? ""}`,
    `contactPhone: ${input.contact?.phone ?? ""}`,
    `contactAddress: ${input.contact?.address ?? ""}`,
    buildSchemaPrompt()
  ].join("\n");
};

const normalizeFeatures = (content: SiteContent, input: GenerationInput): SiteContent => {
  const includeReservation = Boolean(input.features?.includeReservation);
  const includeGallery = Boolean(input.features?.includeGallery);
  const includeMenu = Boolean(input.features?.includeMenu);

  const next: SiteContent = {
    ...content,
    gallery: includeGallery ? content.gallery : undefined,
    menu: includeMenu ? content.menu : undefined,
    reservation: includeReservation ? content.reservation ?? {
      enabled: true,
      title: "Reserve a table",
      description: "Book your visit and we will confirm shortly."
    } : undefined,
    contact: {
      ...content.contact,
      email: input.contact?.email ?? content.contact.email,
      phone: input.contact?.phone ?? content.contact.phone,
      address: input.contact?.address ?? content.contact.address
    }
  };

  if (next.reservation) {
    next.reservation = {
      ...next.reservation,
      enabled: includeReservation
    };
  }

  return next;
};

export const buildFallbackContent = (input: GenerationInput): SiteContent => {
  const includeReservation = Boolean(input.features?.includeReservation);
  const includeGallery = Boolean(input.features?.includeGallery);
  const includeMenu = Boolean(input.features?.includeMenu);
  const shortDescription = input.description || `Trusted ${input.industry} services.`;

  return normalizeFeatures(
    {
      hero: {
        headline: `${input.businessName} ${input.industry}`,
        subheadline: shortDescription,
        ctaLabel: "Get in touch",
        ctaHref: "#contact"
      },
      about: {
        title: `About ${input.businessName}`,
        body: `${input.businessName} delivers dependable ${input.industry.toLowerCase()} support with a focus on quality and consistency.`
      },
      services: {
        title: "Services",
        items: [
          {
            title: "Signature service",
            body: `Purpose-built ${input.industry.toLowerCase()} solutions tailored to your goals.`
          },
          {
            title: "Personalized support",
            body: "Clear guidance, fast response times, and a steady hand from start to finish."
          },
          {
            title: "Ongoing care",
            body: "We stay involved after launch to keep everything running smoothly."
          }
        ]
      },
      gallery: includeGallery
        ? {
            title: "Gallery",
            images: [
              {
                url: "https://images.pexels.com/photos/67468/pexels-photo-67468.jpeg?auto=compress&cs=tinysrgb&w=1200",
                alt: `${input.businessName} featured`
              },
              {
                url: "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=1200",
                alt: `${input.businessName} space`
              },
              {
                url: "https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=1200",
                alt: `${input.businessName} detail`
              }
            ]
          }
        : undefined,
      menu: includeMenu
        ? {
            title: "Menu",
            items: [
              {
                name: "Chef's special",
                description: "Seasonal ingredients with a bold, balanced flavor profile.",
                price: "$18"
              },
              {
                name: "House favorite",
                description: "A guest-loved classic with a modern twist.",
                price: "$14"
              },
              {
                name: "Fresh salad",
                description: "Crisp greens, herbs, and a bright vinaigrette.",
                price: "$11"
              }
            ]
          }
        : undefined,
      reservation: includeReservation
        ? {
            enabled: true,
            title: "Reserve a table",
            description: "Book your visit and we will confirm shortly."
          }
        : undefined,
      contact: {
        title: "Contact",
        body: "Tell us what you need and we will follow up quickly.",
        email: input.contact?.email ?? undefined,
        phone: input.contact?.phone ?? undefined,
        address: input.contact?.address ?? undefined
      },
      footer: {
        text: `© ${new Date().getFullYear()} ${input.businessName}. All rights reserved.`
      }
    },
    input
  );
};

const parseContent = (raw: string) => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid JSON" };
  }

  const result = SiteContentSchema.safeParse(parsed);
  if (!result.success) {
    return { error: result.error.message };
  }

  return { content: result.data };
};

export async function generateSiteContent(input: GenerationInput): Promise<SiteContent | null> {
  const openai = getOpenAIClient();
  if (!openai) {
    log("error", "OPENAI_API_KEY missing for site generation");
    return null;
  }

  const prompt = buildPrompt(input);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ]
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseContent(raw);
    if (parsed.content) {
      return normalizeFeatures(parsed.content, input);
    }

    const fixPrompt = [
      "The JSON did not match the schema. Fix it and return JSON only.",
      buildSchemaPrompt(),
      `Errors: ${parsed.error ?? "Unknown error"}`,
      `Invalid JSON: ${raw}`
    ].join("\n");

    const fix = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: fixPrompt }
      ]
    });

    const fixRaw = fix.choices[0]?.message?.content ?? "";
    const fixedParsed = parseContent(fixRaw);
    if (fixedParsed.content) {
      return normalizeFeatures(fixedParsed.content, input);
    }

    log("error", "AI content validation failed", { error: fixedParsed.error });
    return null;
  } catch (error) {
    log("error", "AI site content generation failed", { error });
    return null;
  }
}

export async function regenerateSection(
  input: GenerationInput,
  sectionKey: SectionKey,
  currentContent: SiteContent
): Promise<SiteContent[SectionKey] | null> {
  const openai = getOpenAIClient();
  if (!openai) {
    log("error", "OPENAI_API_KEY missing for section regeneration");
    return null;
  }

  const sectionSchema = SiteContentSchema.shape[sectionKey];
  const currentSection = currentContent[sectionKey];

  const prompt = [
    "Regenerate only the section below.",
    `sectionKey: ${sectionKey}`,
    `businessName: ${input.businessName}`,
    `industry: ${input.industry}`,
    `description: ${input.description}`,
    "Return JSON only for that section.",
    `Current section: ${JSON.stringify(currentSection)}`,
    `Schema: ${sectionSchema.toString()}`
  ].join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ]
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      log("warn", "AI section parse failed", { error });
      return null;
    }

    const sectionValue = (parsed as Record<string, unknown>)[sectionKey] ?? parsed;
    const result = sectionSchema.safeParse(sectionValue);
    if (!result.success) {
      log("warn", "AI section validation failed", { error: result.error.message });
      return null;
    }

    if (sectionKey === "contact") {
      const contactData = result.data as SiteContent["contact"];
      return {
        ...contactData,
        email: input.contact?.email ?? contactData.email ?? currentContent.contact.email,
        phone: input.contact?.phone ?? contactData.phone ?? currentContent.contact.phone,
        address: input.contact?.address ?? contactData.address ?? currentContent.contact.address
      };
    }

    return result.data;
  } catch (error) {
    log("error", "AI section regeneration failed", { error });
    return null;
  }
}
