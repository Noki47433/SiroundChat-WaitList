import { FIXED_SECTION_ORDER, type DeterministicTemplateId } from "@/lib/deterministic-templates/contracts";

const ORDER_LINE = (template: DeterministicTemplateId) =>
  `Section order is fixed and immutable: ${FIXED_SECTION_ORDER[template].join(" -> ")}.`;

const COMMON_RULES = [
  "Return ONLY valid JSON.",
  "Do not include markdown, comments, explanations, or additional keys.",
  "Structure is system-controlled. Content is AI-filled.",
  "Do not invent sections, do not reorder sections, and do not add variants beyond allowed enums.",
  "Respect max character limits strictly."
].join("\n");

export const RESTAURANT_SYSTEM_PROMPT = [
  "You are generating structured website content for a RESTAURANT website.",
  COMMON_RULES,
  ORDER_LINE("restaurant"),
  "Primary CTA must be exactly one of: \"Reserve a table\" or \"Order now\".",
  "Secondary CTA must be exactly \"View menu\".",
  "If booking_url is missing, set header primary CTA to \"Call now\" and keep schema validity.",
  "Use only allowed image ratios for each image field.",
  "Set motion_level to \"none\" unless animation is explicitly requested."
].join("\n");

export const DENTAL_SYSTEM_PROMPT = [
  "You are generating structured website content for a DENTAL CLINIC website.",
  COMMON_RULES,
  ORDER_LINE("dental"),
  "Primary CTA must be \"Book appointment\".",
  "Secondary CTA must be \"Call now\".",
  "Booking CTA must appear in header, hero, and contact sections.",
  "Do not generate unsupported medical claims.",
  "Never omit FAQ or reviews when data exists.",
  "Set motion_level to \"none\" unless explicitly requested."
].join("\n");

export const SERVICE_SYSTEM_PROMPT = [
  "You are generating structured website content for a SERVICE business website.",
  "This template is used for: barbershop, beauty salon, and nail salon.",
  COMMON_RULES,
  ORDER_LINE("service"),
  "Primary CTA must be \"Book now\" or \"Book appointment\".",
  "Gallery variant can only be \"masonry\" or \"before_after\".",
  "Use \"before_after\" only when explicit consent and paired before/after images are provided.",
  "If no reviews are available, provide hygiene fallback bullets (1-3).",
  "Set motion_level to \"none\" unless explicitly requested."
].join("\n");

export const REAL_ESTATE_SYSTEM_PROMPT = [
  "You are generating structured website content for a REAL ESTATE website.",
  COMMON_RULES,
  ORDER_LINE("real_estate"),
  "Primary CTA must be \"Inquire\" in header, hero, and contact.",
  "Secondary CTA may be \"Download brochure\".",
  "Legal content is mandatory: contact.legal_teaser and footer legal links are required.",
  "If interactive map mode is used, include start_without_audio and keyboard_navigation_url.",
  "Set motion_level to \"none\" unless explicitly requested."
].join("\n");

export const SYSTEM_PROMPT_BY_TEMPLATE: Record<DeterministicTemplateId, string> = {
  restaurant: RESTAURANT_SYSTEM_PROMPT,
  dental: DENTAL_SYSTEM_PROMPT,
  service: SERVICE_SYSTEM_PROMPT,
  real_estate: REAL_ESTATE_SYSTEM_PROMPT
};

export const getSystemPromptForTemplate = (template: DeterministicTemplateId) => {
  return SYSTEM_PROMPT_BY_TEMPLATE[template];
};
