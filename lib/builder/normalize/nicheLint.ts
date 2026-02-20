import type { NicheRules } from "@/lib/builder/niche";
import type { SiteDocument } from "@/lib/website-builder/types";

const containsForbiddenTopic = (value: string, forbiddenTopics: string[]) => {
  const normalized = value.toLowerCase();
  return forbiddenTopics.some((topic) => normalized.includes(topic.toLowerCase()));
};

export const applyNicheLint = (siteDocument: SiteDocument, rules: NicheRules): SiteDocument => {
  if (!rules.forbiddenTopics.length || !rules.defaultBulletPool.length) {
    return siteDocument;
  }

  let replacementIndex = 0;

  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      if (!containsForbiddenTopic(value, rules.forbiddenTopics)) return value;
      const replacement = rules.defaultBulletPool[replacementIndex % rules.defaultBulletPool.length];
      replacementIndex += 1;
      return replacement;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => sanitizeValue(entry));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeValue(entry)])
      );
    }

    return value;
  };

  return {
    ...siteDocument,
    pages: siteDocument.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        content: sanitizeValue(section.content) as Record<string, any>
      }))
    }))
  };
};

