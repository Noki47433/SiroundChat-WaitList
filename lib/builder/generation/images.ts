import { searchPexels } from "@/lib/website-builder/images/pexels";
import type { GenerationSiteDocument } from "@/lib/builder/generation/schemas/site";
import type { StrictSection } from "@/lib/builder/generation/schemas/sections";
import { getTemplateById } from "@/lib/builder/generation/templates/registry";
import type { GenerationIntake } from "@/lib/builder/generation/types";

const CURATED_FALLBACKS: Record<string, string[]> = {
  hero: ["https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg"],
  gallery: [
    "https://images.pexels.com/photos/3184431/pexels-photo-3184431.jpeg",
    "https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg",
    "https://images.pexels.com/photos/3184398/pexels-photo-3184398.jpeg"
  ],
  about: ["https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg"],
  cta: ["https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg"]
};

const shotTypeBySlot = (slot: string) => {
  if (slot.includes("hero")) return "wide";
  if (slot.includes("gallery")) return "detail";
  return "natural";
};

const negativeTerms = (businessType: string) => {
  const value = businessType.toLowerCase();
  if (value.includes("clinic") || value.includes("dental")) return "-restaurant -food -table";
  if (value.includes("restaurant") || value.includes("cafe")) return "-hospital -dental";
  return "";
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const relevanceScore = (query: string, candidate: { alt?: string; sourceUrl?: string }) => {
  const queryTokens = new Set(tokenize(query));
  const haystack = `${candidate.alt ?? ""} ${candidate.sourceUrl ?? ""}`.toLowerCase();
  if (!queryTokens.size) return 0;
  let hits = 0;
  queryTokens.forEach((token) => {
    if (haystack.includes(token)) hits += 1;
  });
  return hits / queryTokens.size;
};

const pickUploadedImage = (
  uploads: NonNullable<GenerationIntake["uploadedImages"]>,
  used: Set<string>,
  seedIndex: number
) => {
  if (!uploads.length) return null;
  for (let i = 0; i < uploads.length; i += 1) {
    const candidate = uploads[(seedIndex + i) % uploads.length];
    if (!candidate?.src || used.has(candidate.src)) continue;
    return candidate;
  }
  return null;
};

const buildQuery = (
  intake: GenerationIntake,
  section: StrictSection,
  slot: string
) => {
  const service = intake.services[0] ?? intake.businessType;
  const context = section.type;
  const locale = intake.location ?? "local";
  const shotType = shotTypeBySlot(slot);
  const style = intake.toneProfile;
  const negative = negativeTerms(intake.businessType);
  return `${intake.businessType} ${service} ${context} ${locale} ${shotType} ${style} ${negative}`.trim();
};

const withSectionUpdate = (
  doc: GenerationSiteDocument,
  sectionId: string,
  updater: (section: StrictSection) => StrictSection
): GenerationSiteDocument => ({
  ...doc,
  pages: doc.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => (section.sectionId === sectionId ? updater(section) : section))
  }))
});

export async function applyDeterministicImages(
  document: GenerationSiteDocument,
  intake: GenerationIntake
): Promise<GenerationSiteDocument> {
  const template = getTemplateById(document.templateId);
  if (!template) return document;

  let next = document;
  const usedSrc = new Set<string>();
  const uploads = intake.uploadedImages ?? [];
  let uploadCursor = 0;

  for (const page of next.pages) {
    for (const section of page.sections) {
      if (!section.enabled) continue;
      const requiredSlots = template.requiredImageSlots[section.type]?.[section.variant] ?? [];
      const heroHint =
        section.type === "hero" && section.content?.image
          ? {
              slotId:
                typeof section.content.image.slotId === "string" && section.content.image.slotId.trim()
                  ? section.content.image.slotId.trim()
                  : "hero-main",
              query:
                typeof section.content.image.query === "string" && section.content.image.query.trim()
                  ? section.content.image.query.trim()
                  : null,
              alt:
                typeof section.content.image.alt === "string" && section.content.image.alt.trim()
                  ? section.content.image.alt.trim()
                  : null
            }
          : null;
      const optionalSlots =
        section.type === "hero" && !requiredSlots.length
          ? [heroHint?.slotId ?? "hero-main"]
          : [];
      const slotsToFill = [...requiredSlots, ...optionalSlots.filter((slot) => !requiredSlots.includes(slot))];
      if (!slotsToFill.length) continue;

      const images = [...(section.images ?? [])];
      const bySlot = new Set(images.map((image) => image.slot));

      for (const slot of slotsToFill) {
        if (bySlot.has(slot)) continue;

        const uploaded = pickUploadedImage(uploads, usedSrc, uploadCursor);
        if (uploaded) {
          uploadCursor += 1;
          images.push({
            slot,
            src: uploaded.src,
            alt: uploaded.alt ?? `${intake.businessName} ${section.type} image`,
            width: uploaded.width ?? 1600,
            height: uploaded.height ?? 1000,
            query: `upload:${slot}`
          });
          usedSrc.add(uploaded.src);
          bySlot.add(slot);
          continue;
        }

        const query = heroHint?.query && slot === heroHint.slotId ? heroHint.query : buildQuery(intake, section, slot);
        let picked: {
          src: string;
          alt: string;
          width: number;
          height: number;
          query: string;
        } | null = null;

        try {
          const results = await searchPexels(query, 12);
          const unique = results.find((candidate) => !usedSrc.has(candidate.url));
          if (unique && relevanceScore(query, { alt: unique.alt, sourceUrl: unique.sourceUrl }) >= 0.15) {
            picked = {
              src: unique.url,
              alt: heroHint?.alt || unique.alt || `${intake.businessName} ${section.type} image`,
              width: unique.width || 1600,
              height: unique.height || 1000,
              query
            };
          }
        } catch {
          // no-op
        }

        if (!picked) {
          const fallbackList = CURATED_FALLBACKS[section.type] ?? [];
          const fallbackSrc = fallbackList.find((src) => !usedSrc.has(src));
          if (fallbackSrc) {
            picked = {
              src: fallbackSrc,
              alt: heroHint?.alt || `${intake.businessName} ${section.type} image`,
              width: 1600,
              height: 1000,
              query
            };
          }
        }

        if (picked) {
          images.push({
            slot,
            src: picked.src,
            alt: picked.alt,
            width: picked.width,
            height: picked.height,
            query: picked.query
          });
          usedSrc.add(picked.src);
          bySlot.add(slot);
        }
      }

      if (requiredSlots.some((slot) => !bySlot.has(slot))) {
        next = withSectionUpdate(next, section.sectionId, (current) => ({
          ...current,
          variant: "A",
          images: []
        }));
      } else {
        next = withSectionUpdate(next, section.sectionId, (current) => ({
          ...current,
          images
        }));
      }
    }
  }

  return next;
}
