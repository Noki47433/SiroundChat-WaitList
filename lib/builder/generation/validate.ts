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
  const errorsBySectionId: Record<string, ValidationIssue[]> = {};
  const errorsGlobal: ValidationIssue[] = [];
  const parsed = GenerationSiteDocumentSchema.safeParse(siteDoc);

  const raw = siteDoc as any;
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      const sectionIndex =
        issue.path[0] === "pages" && issue.path[2] === "sections" && typeof issue.path[3] === "number"
          ? (issue.path[3] as number)
          : null;
      const pageIndex = issue.path[0] === "pages" && typeof issue.path[1] === "number" ? (issue.path[1] as number) : 0;
      const sectionId =
        sectionIndex !== null
          ? raw?.pages?.[pageIndex]?.sections?.[sectionIndex]?.sectionId
          : null;

      const normalized: ValidationIssue = {
        code: "schema",
        message: issue.message,
        path: issue.path as Array<string | number>
      };

      if (sectionId && typeof sectionId === "string") {
        addSectionError(errorsBySectionId, sectionId, normalized);
      } else {
        errorsGlobal.push(normalized);
      }
    });
  }

  const doc = parsed.success ? parsed.data : null;
  if (!doc) {
    return {
      ok: false,
      errorsBySectionId,
      errorsGlobal
    };
  }

  const template = getTemplateById(doc.templateId);
  if (!template) {
    errorsGlobal.push({
      code: "template",
      message: `Unknown template: ${doc.templateId}`
    });
  }

  const seenSectionIds = new Set<string>();
  const duplicateIds = new Set<string>();

  doc.pages.forEach((page, pageIndex) => {
    const enabledCount = page.sections.filter((section) => section.enabled).length;
    if (enabledCount > 10) {
      errorsGlobal.push({
        code: "section_limit",
        message: `Page ${page.slug} has more than 10 enabled sections.`,
        path: ["pages", pageIndex, "sections"]
      });
    }

    const enabledSections = page.sections.filter((section) => section.enabled);
    const firstEnabled = enabledSections[0];
    if (!firstEnabled || firstEnabled.type !== "hero") {
      errorsGlobal.push({
        code: "hierarchy",
        message: `Page ${page.slug} must start with an enabled hero section.`,
        path: ["pages", pageIndex, "sections"]
      });
    }

    const spacingProfiles = new Set(enabledSections.map((section) => section.spacingProfile));
    if (spacingProfiles.size > 2) {
      errorsGlobal.push({
        code: "spacing",
        message: `Page ${page.slug} uses too many spacing profiles.`,
        path: ["pages", pageIndex, "sections"]
      });
    }

    page.sections.forEach((section, sectionIndex) => {
      if (seenSectionIds.has(section.sectionId)) {
        duplicateIds.add(section.sectionId);
      } else {
        seenSectionIds.add(section.sectionId);
      }

      if (!TOKEN_SET_IDS.includes(section.tokenSetId)) {
        addSectionError(errorsBySectionId, section.sectionId, {
          code: "token_allowlist",
          message: `Token set ${section.tokenSetId} is not allowed.`,
          path: ["pages", pageIndex, "sections", sectionIndex, "tokenSetId"]
        });
      }

      const bannedHits = findBannedCopyHits(section.content);
      if (bannedHits.length > BANNED_HIT_THRESHOLD) {
        addSectionError(errorsBySectionId, section.sectionId, {
          code: "banned_copy",
          message: `Found ${bannedHits.length} banned copy hit(s), threshold ${BANNED_HIT_THRESHOLD}.`
        });
      }

      if (template) {
        const allowedVariants = template.allowedVariants[section.type] as string[];
        if (!allowedVariants.includes(section.variant)) {
          addSectionError(errorsBySectionId, section.sectionId, {
            code: "variant",
            message: `Variant ${section.variant} is invalid for section ${section.type}.`
          });
        }

        const requiredSlots = template.requiredImageSlots[section.type]?.[section.variant] ?? [];
        if (requiredSlots.length > 0 && section.enabled) {
          const existingSlots = new Set((section.images ?? []).map((image) => image.slot));
          const missing = requiredSlots.filter((slot) => !existingSlots.has(slot));
          if (missing.length > 0) {
            addSectionError(errorsBySectionId, section.sectionId, {
              code: "required_imagery",
              message: `Missing required image slots: ${missing.join(", ")}`
            });
          }
        }
      }

      validateCopyLimits(section, errorsBySectionId);
    });
  });

  duplicateIds.forEach((duplicateId) => {
    addSectionError(errorsBySectionId, duplicateId, {
      code: "duplicate_id",
      message: "Duplicate section ID detected."
    });
  });

  const hero = doc.pages
    .flatMap((page) => page.sections)
    .find((section): section is Extract<StrictSection, { type: "hero" }> => section.type === "hero");
  const heroCount = doc.pages.flatMap((page) => page.sections).filter((section) => section.type === "hero").length;
  if (heroCount !== 1) {
    errorsGlobal.push({
      code: "hierarchy",
      message: "Site must contain exactly one hero section."
    });
  }
  if (!hero || !hero.enabled) {
    errorsGlobal.push({
      code: "hero_required",
      message: "Hero section must exist and remain enabled."
    });
  } else if (!hero.content.primaryCta?.label) {
    addSectionError(errorsBySectionId, hero.sectionId, {
      code: "hero_cta",
      message: "Hero section must include a primary CTA."
    });
  }

  return {
    ok: errorsGlobal.length === 0 && Object.keys(errorsBySectionId).length === 0,
    errorsBySectionId,
    errorsGlobal
  };
}
