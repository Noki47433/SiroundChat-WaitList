import type { NicheKey } from "@/lib/builder/niche";
import { TEMPLATE_DEFAULT_SECTIONS } from "@/lib/website-builder/templates/registry";
import type { SiteSection } from "@/lib/website-builder/types";

export type TemplatePreset = {
  templateId: string;
  allowedTemplateIds: string[];
  sectionOrder: SiteSection["type"][];
  variantBias: Partial<Record<SiteSection["type"], string>>;
};

type ResolveTemplatePresetInput = {
  nicheKey: NicheKey;
  requestedTemplateId: string;
  allowedSectionTypes: SiteSection["type"][];
  requiredSectionTypes: SiteSection["type"][];
};

const DEFAULT_ORDER: SiteSection["type"][] = [
  "hero",
  "about",
  "services",
  "testimonials",
  "pricing",
  "gallery",
  "faq",
  "cta",
  "reservation",
  "contact",
  "footer"
];

const ORDER_BY_NICHE: Partial<Record<NicheKey, SiteSection["type"][]>> = {
  clinic: ["hero", "services", "reservation", "contact", "faq", "about", "gallery", "cta", "footer"],
  restaurant: ["hero", "services", "gallery", "reservation", "contact", "testimonials", "faq", "footer"],
  barber: ["hero", "services", "gallery", "reservation", "contact", "testimonials", "footer"],
  gym: ["hero", "services", "testimonials", "reservation", "contact", "gallery", "faq", "footer"],
  "real-estate": ["hero", "services", "gallery", "testimonials", "contact", "faq", "footer"],
  agency: ["hero", "services", "about", "testimonials", "contact", "cta", "faq", "footer"],
  generic: DEFAULT_ORDER
};

const TEMPLATE_BY_NICHE: Record<NicheKey, string> = {
  clinic: "clinic-clean",
  restaurant: "restaurant-editorial",
  barber: "beauty-lux",
  gym: "auto-modern",
  "real-estate": "corporate-sleek",
  agency: "corporate-sleek",
  generic: "auto-modern"
};

const VARIANT_BIAS_BY_NICHE: Record<NicheKey, Partial<Record<SiteSection["type"], string>>> = {
  clinic: { hero: "B", services: "C", reservation: "B", contact: "A" },
  restaurant: { hero: "B", services: "A", gallery: "B", reservation: "A" },
  barber: { hero: "B", services: "B", gallery: "B" },
  gym: { hero: "B", services: "B", testimonials: "B" },
  "real-estate": { hero: "B", services: "C", testimonials: "B" },
  agency: { hero: "B", services: "C", cta: "B" },
  generic: { hero: "B", services: "B" }
};

const dedupe = <T,>(list: T[]) => {
  const seen = new Set<T>();
  return list.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
};

const insertBeforeFooter = (order: SiteSection["type"][], type: SiteSection["type"]) => {
  const footerIndex = order.indexOf("footer");
  if (footerIndex === -1) {
    order.push(type);
    return;
  }
  order.splice(footerIndex, 0, type);
};

export const resolveTemplatePreset = ({
  nicheKey,
  requestedTemplateId,
  allowedSectionTypes,
  requiredSectionTypes
}: ResolveTemplatePresetInput): TemplatePreset => {
  const preferredTemplate = TEMPLATE_DEFAULT_SECTIONS[requestedTemplateId]
    ? requestedTemplateId
    : TEMPLATE_BY_NICHE[nicheKey];
  const nicheTemplate = TEMPLATE_BY_NICHE[nicheKey];

  const allowedTemplateIds = dedupe(
    [preferredTemplate, nicheTemplate, "auto-modern"].filter((id) => Boolean(TEMPLATE_DEFAULT_SECTIONS[id]))
  );

  const allowedTypeSet = new Set<SiteSection["type"]>(allowedSectionTypes);
  const requiredTypeSet = new Set<SiteSection["type"]>(requiredSectionTypes);
  const baseOrder = ORDER_BY_NICHE[nicheKey] ?? DEFAULT_ORDER;

  const sectionOrder = dedupe(baseOrder.filter((type) => allowedTypeSet.has(type)));
  requiredSectionTypes.forEach((type) => {
    if (!allowedTypeSet.has(type)) return;
    if (sectionOrder.includes(type)) return;
    if (type === "footer") {
      sectionOrder.push(type);
      return;
    }
    insertBeforeFooter(sectionOrder, type);
  });

  if (allowedTypeSet.has("hero") && !sectionOrder.includes("hero")) {
    sectionOrder.unshift("hero");
  }
  if (allowedTypeSet.has("footer") && !sectionOrder.includes("footer")) {
    sectionOrder.push("footer");
  }

  const finalOrder = sectionOrder.filter((type) => allowedTypeSet.has(type));
  const fallbackOrder = dedupe(
    [
      ...finalOrder,
      ...Array.from(requiredTypeSet.values()).filter((type) => allowedTypeSet.has(type)),
      ...Array.from(allowedTypeSet.values())
    ].filter((type) => type !== "footer")
  );

  const withFooter = [...fallbackOrder];
  if (allowedTypeSet.has("footer")) withFooter.push("footer");

  return {
    templateId: preferredTemplate,
    allowedTemplateIds,
    sectionOrder: dedupe(withFooter),
    variantBias: VARIANT_BIAS_BY_NICHE[nicheKey] ?? {}
  };
};

