import type { LayoutDNA } from "@/lib/builder/generation/v2/types";

export const LAYOUT_DNA_REGISTRY: LayoutDNA[] = [
  {
    id: "split_showcase",
    label: "Split Showcase",
    compatibleIndustries: ["barbershop", "restaurant", "dental_clinic", "real_estate"],
    heroVariant: "A",
    sectionVariantBias: {
      hero: ["A", "C"],
      services: ["D", "G"],
      about: ["E", "D"],
      pricing: ["C", "D"],
      testimonials: ["C", "D"],
      contact: ["D", "E"],
      cta: ["D", "F"],
      reservation: ["B", "A"]
    },
    sectionRhythm: ["base", "soft", "contrast", "base", "brand", "base"],
    spacing: "normal",
    alignment: "left",
    cardDensity: "balanced",
    imageUsage: "hero image plus one later showcase section",
    ctaPlacement: "early hero CTA and late conversion panel",
    contrastNotes: "alternates calm sections with one stronger contrast section"
  },
  {
    id: "editorial_stack",
    label: "Editorial Stack",
    compatibleIndustries: ["barbershop", "restaurant", "dental_clinic", "real_estate"],
    heroVariant: "C",
    sectionVariantBias: {
      hero: ["C", "B"],
      services: ["E", "F"],
      about: ["E", "F"],
      pricing: ["D", "C"],
      testimonials: ["C", "E"],
      gallery: ["E", "D"],
      contact: ["E", "D"],
      cta: ["E", "D"]
    },
    sectionRhythm: ["brand", "base", "soft", "base", "contrast", "base"],
    spacing: "airy",
    alignment: "left",
    cardDensity: "airy",
    imageUsage: "editorial imagery and generous negative space",
    ctaPlacement: "single strong CTA after education and proof",
    contrastNotes: "hero and CTA get stronger treatment; middle sections stay refined"
  },
  {
    id: "immersive_stack",
    label: "Immersive Stack",
    compatibleIndustries: ["barbershop", "restaurant", "real_estate"],
    heroVariant: "B",
    sectionVariantBias: {
      hero: ["B", "D"],
      gallery: ["D", "E"],
      pricing: ["D", "E"],
      testimonials: ["D", "F"],
      cta: ["D", "F"],
      contact: ["D", "F"]
    },
    sectionRhythm: ["image", "contrast", "base", "soft", "brand", "base"],
    spacing: "airy",
    alignment: "center",
    cardDensity: "balanced",
    imageUsage: "large-image lead with darker contrast follow-up",
    ctaPlacement: "hero CTA plus immersive late CTA",
    contrastNotes: "best for visual categories that need drama"
  },
  {
    id: "centered_story",
    label: "Centered Story",
    compatibleIndustries: ["restaurant", "dental_clinic"],
    heroVariant: "D",
    sectionVariantBias: {
      hero: ["D", "C"],
      about: ["E", "F"],
      services: ["F", "E"],
      faq: ["C", "B"],
      contact: ["E", "D"],
      cta: ["E", "D"],
      reservation: ["C", "B"]
    },
    sectionRhythm: ["soft", "base", "soft", "base", "brand", "base"],
    spacing: "airy",
    alignment: "center",
    cardDensity: "airy",
    imageUsage: "fewer cards, more centered storytelling blocks",
    ctaPlacement: "single clear CTA after the mid-page conviction point",
    contrastNotes: "soft high-trust pacing"
  },
  {
    id: "conversion_grid",
    label: "Conversion Grid",
    compatibleIndustries: ["dental_clinic", "real_estate"],
    heroVariant: "A",
    sectionVariantBias: {
      hero: ["A", "C"],
      services: ["G", "F"],
      pricing: ["E", "C"],
      testimonials: ["F", "E"],
      contact: ["F", "E"],
      cta: ["F", "E"],
      faq: ["C", "B"]
    },
    sectionRhythm: ["base", "base", "soft", "contrast", "brand", "base"],
    spacing: "normal",
    alignment: "left",
    cardDensity: "compact",
    imageUsage: "utility-first with one focused visual showcase",
    ctaPlacement: "hero CTA, proof, then conversion strip",
    contrastNotes: "higher information density without feeling cramped"
  }
];
