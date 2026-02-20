import type { SiteContent, TemplateKey } from "@/lib/builder/types";

const resolveTemplateKeyFromId = (templateId?: string | null): TemplateKey | null => {
  const value = (templateId ?? "").trim();
  if (!value) return null;
  if (value === "restaurant-editorial") return "restaurant_v1";
  if (["clinic-clean", "beauty-lux", "corporate-sleek", "auto-modern"].includes(value)) {
    return "service_v1";
  }
  if (["portfolio-minimal", "ecommerce-simple", "hospitality-resort"].includes(value)) {
    return "generic_v1";
  }
  return null;
};

export const selectTemplateKey = (industry: string, templateId?: string | null): TemplateKey => {
  const fromTemplate = resolveTemplateKeyFromId(templateId);
  if (fromTemplate) return fromTemplate;
  const normalized = industry.toLowerCase();
  if (normalized.includes("restaurant")) return "restaurant_v1";
  if (
    normalized.includes("agency") ||
    normalized.includes("consulting") ||
    normalized.includes("service")
  ) {
    return "service_v1";
  }
  return "generic_v1";
};

export const slugify = (value: string) => {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "site";
};

const trimTo = (value: string, max: number) => {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3)).trim()}...`;
};

type SeoInput = {
  businessName: string;
  industry: string;
  description?: string | null;
  content?: SiteContent | null;
};

export const buildSeoFields = ({ businessName, industry, description, content }: SeoInput) => {
  const baseTitle = businessName ? `${businessName} | ${industry}` : content?.hero.headline ?? "SiroundChat";
  const rawDescription =
    content?.hero.subheadline || description || content?.about.body || "Learn more about this business.";

  return {
    seoTitle: trimTo(baseTitle, 60),
    seoDescription: trimTo(rawDescription, 155)
  };
};

export const buildSitePath = (slug: string) => `/s/${slug}`;
