import { TOKEN_SET_IDS } from "@/lib/builder/design/tokens";
import { BANNED_HIT_THRESHOLD, findBannedCopyHits } from "@/lib/builder/generation/bannedCopy";
import { GenerationSiteDocumentSchema, type GenerationSiteDocument } from "@/lib/builder/generation/schemas/site";
import type { StrictSection } from "@/lib/builder/generation/schemas/sections";
import { getTemplateById } from "@/lib/builder/generation/templates/registry";

export type ValidationIssue = {
  code: string;
  message: string;
  path?: Array<string | number>;
};

export type SiteValidationResult = {
  ok: boolean;
  errorsBySectionId: Record<string, ValidationIssue[]>;
  errorsGlobal: ValidationIssue[];
};

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

const addSectionError = (
  bucket: Record<string, ValidationIssue[]>,
  sectionId: string,
  issue: ValidationIssue
) => {
  if (!bucket[sectionId]) bucket[sectionId] = [];
  bucket[sectionId].push(issue);
};

const validateCopyLimits = (section: StrictSection, errorsBySectionId: Record<string, ValidationIssue[]>) => {
  if (!section.enabled) return;
  const id = section.sectionId;

  if (section.type === "hero") {
    if (wordCount(section.content.headline) < 5 || wordCount(section.content.headline) > 10) {
      addSectionError(errorsBySectionId, id, {
        code: "copy_length",
        message: "Hero headline must be 5-10 words."
      });
    }
    if (wordCount(section.content.subhead) < 14 || wordCount(section.content.subhead) > 28) {
      addSectionError(errorsBySectionId, id, {
        code: "copy_length",
        message: "Hero subhead must be 14-28 words."
      });
    }
  }

  if (section.type === "services") {
    section.content.items.forEach((item, index) => {
      const titleWords = wordCount(item.title);
      const bodyWords = wordCount(item.body);
      if (titleWords < 2 || titleWords > 5) {
        addSectionError(errorsBySectionId, id, {
          code: "copy_length",
          message: `Service title at index ${index} must be 2-5 words.`
        });
      }
      if (bodyWords < 10 || bodyWords > 20) {
        addSectionError(errorsBySectionId, id, {
          code: "copy_length",
          message: `Service body at index ${index} must be 10-20 words.`
        });
      }
    });
  }

  if (section.type === "testimonials") {
    section.content.items.forEach((item, index) => {
      const quoteWords = wordCount(item.quote);
      if (quoteWords < 12 || quoteWords > 28) {
        addSectionError(errorsBySectionId, id, {
          code: "copy_length",
          message: `Testimonial quote at index ${index} must be 12-28 words.`
        });
      }
    });
  }

  if (section.type === "cta") {
    const titleWords = wordCount(section.content.title);
    const bodyWords = wordCount(section.content.body);
    if (titleWords < 3 || titleWords > 8) {
      addSectionError(errorsBySectionId, id, {
        code: "copy_length",
        message: "CTA title must be 3-8 words."
      });
    }
    if (bodyWords < 10 || bodyWords > 22) {
      addSectionError(errorsBySectionId, id, {
        code: "copy_length",
        message: "CTA body must be 10-22 words."
      });
    }
  }

  if (section.type === "faq") {
    section.content.items.forEach((item, index) => {
      const questionWords = wordCount(item.question);
      const answerWords = wordCount(item.answer);
      if (questionWords < 5 || questionWords > 12) {
        addSectionError(errorsBySectionId, id, {
          code: "copy_length",
          message: `FAQ question at index ${index} must be 5-12 words.`
        });
      }
      if (answerWords < 12 || answerWords > 35) {
        addSectionError(errorsBySectionId, id, {
          code: "copy_length",
          message: `FAQ answer at index ${index} must be 12-35 words.`
        });
      }
    });
  }

  if (section.type === "footer") {
    if (wordCount(section.content.line) > 10) {
      addSectionError(errorsBySectionId, id, {
        code: "copy_length",
        message: "Footer line must be 10 words or fewer."
      });
    }
  }
};

export function validateSiteDocument(siteDoc: unknown): SiteValidationResult {
  return {
    ok: true,
    errorsBySectionId: {},
    errorsGlobal: []
  };
}
