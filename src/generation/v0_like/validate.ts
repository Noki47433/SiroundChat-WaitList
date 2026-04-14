import {
  type WebsitePlan,
  validateWebsitePlan,
  type WebsitePlanValidationError
} from "@/src/generation/v0_like/schema";
import {
  allowedSectionsByVertical,
  defaultOrderByVertical,
  promptExplicitlyRequestsPricing,
  promptLikelyContainsRealMetrics
} from "@/src/generation/v0_like/registry";
import { isRestaurantFontAllowed } from "@/src/generation/v0_like/tokens";
import { SECTION_TYPES, type IntakeBrief, type PlanValidationIssue } from "@/src/generation/v0_like/types";

export const BANNED_CTA_LABELS = ["learn more", "get started"] as const;

export const BANNED_COPY_PHRASES = [
  "schema",
  "deterministic",
  "pipeline",
  "retry",
  "validation",
  "test coverage",
  "onboarding",
  "product manager",
  "operations lead",
  "ship a consistent",
  "generation"
] as const;

const RESTAURANT_REQUIRED_ORDER = [
  "header",
  "hero",
  "features",
  "feature_spotlight",
  "contact",
  "testimonials",
  "cta_banner",
  "footer"
] as const;

const RESTAURANT_NAV_REQUIRED_LABELS = ["home", "menu", "reservations", "about", "contact"] as const;
const CLINIC_NAV_REQUIRED_LABELS = ["services", "about", "testimonials", "contact"] as const;

const RESTAURANT_ALT_HINTS = ["restaurant", "food", "dish", "dining", "ambience", "ambiance", "menu"] as const;
const CLINIC_COPY_HINTS = ["dental", "clinic", "smile", "patient", "teeth", "tooth", "hygiene"] as const;

const ALLOWED_ORDER_SWAP_SET = new Set(["features", "feature_spotlight"]);

const pathIssue = (
  path: string,
  message: string,
  code = "business_rule",
  extras?: Pick<PlanValidationIssue, "offendingPhrase" | "replacementRule">
): PlanValidationIssue => ({
  code,
  path,
  message,
  ...(extras ?? {})
});

const mapSchemaIssue = (issue: WebsitePlanValidationError): PlanValidationIssue => ({
  code: "schema",
  path: issue.path,
  message: issue.message
});

const compareOrderWithAllowedSwap = (actual: string[], expected: string[]) => {
  const issues: PlanValidationIssue[] = [];
  if (actual.length !== expected.length) {
    issues.push(pathIssue("sections", "Section list does not match expected order length.", "order"));
    return issues;
  }

  for (let index = 0; index < actual.length; index += 1) {
    const current = actual[index];
    const target = expected[index];
    if (current === target) continue;

    if (ALLOWED_ORDER_SWAP_SET.has(current) && ALLOWED_ORDER_SWAP_SET.has(target)) {
      continue;
    }

    issues.push(
      pathIssue(
        `sections.${index}.type`,
        `Section order mismatch at index ${index}: expected '${target}', got '${current}'.`,
        "order"
      )
    );
  }

  return issues;
};

const hasExplicitGenericLabelRequest = (rawPrompt: string, label: string) => {
  const lowered = rawPrompt.toLowerCase();
  return lowered.includes(label);
};

const collectStrings = (
  value: unknown,
  path = "",
  output: Array<{ path: string; value: string }> = []
): Array<{ path: string; value: string }> => {
  if (typeof value === "string") {
    output.push({ path: path || "root", value });
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStrings(item, path ? `${path}.${index}` : `${index}`, output);
    });
    return output;
  }

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      collectStrings(child, path ? `${path}.${key}` : key, output);
    });
  }

  return output;
};

const validateBannedPhrases = (plan: WebsitePlan): PlanValidationIssue[] => {
  const issues: PlanValidationIssue[] = [];
  const stringFields = collectStrings(plan);

  stringFields.forEach((entry) => {
    const lowered = entry.value.toLowerCase();
    BANNED_COPY_PHRASES.forEach((phrase) => {
      if (!lowered.includes(phrase)) return;
      issues.push(
        pathIssue(entry.path, `Banned phrase '${phrase}' found in copy.`, "banned_phrase", {
          offendingPhrase: phrase,
          replacementRule: "use vertical-appropriate customer-facing language"
        })
      );
    });
  });

  return issues;
};

const validateRestaurantOrder = (sectionTypes: string[]) => {
  const issues: PlanValidationIssue[] = [];
  const required = [...RESTAURANT_REQUIRED_ORDER];

  required.forEach((type) => {
    if (!sectionTypes.includes(type)) {
      issues.push(pathIssue("sections", `Restaurant plan missing required section '${type}'.`, "order"));
    }
  });

  if (issues.length > 0) return issues;

  let previousIndex = -1;
  required.forEach((type) => {
    const index = sectionTypes.indexOf(type);
    if (index < previousIndex) {
      issues.push(pathIssue("sections", `Restaurant section '${type}' is out of order.`, "order"));
    }
    previousIndex = index;
  });

  const pricingIndex = sectionTypes.indexOf("pricing");
  if (pricingIndex >= 0) {
    const testimonialsIndex = sectionTypes.indexOf("testimonials");
    const ctaIndex = sectionTypes.indexOf("cta_banner");
    if (!(pricingIndex > testimonialsIndex && pricingIndex < ctaIndex)) {
      issues.push(
        pathIssue(
          "sections",
          "Restaurant pricing section must appear after testimonials and before cta_banner.",
          "order"
        )
      );
    }
  }

  return issues;
};

const validateRestaurantNavigationAndCta = (plan: WebsitePlan): PlanValidationIssue[] => {
  const issues: PlanValidationIssue[] = [];

  const header = plan.sections.find(
    (section): section is Extract<WebsitePlan["sections"][number], { type: "header" }> => section.type === "header"
  );

  if (!header) {
    issues.push(pathIssue("sections", "Restaurant plan requires a header section.", "restaurant_nav"));
  } else {
    const labels = header.copy.links.map((link) => link.label.trim().toLowerCase());

    RESTAURANT_NAV_REQUIRED_LABELS.forEach((requiredLabel) => {
      if (!labels.includes(requiredLabel)) {
        issues.push(pathIssue("sections", `Restaurant nav missing '${requiredLabel}'.`, "restaurant_nav"));
      }
    });

    const hasMenuAnchor = header.copy.links.some((link) => link.href === "/#menu");
    const hasReservationsAnchor = header.copy.links.some((link) => link.href === "/#reservations");
    if (!hasMenuAnchor) {
      issues.push(pathIssue("sections", "Restaurant nav must include /#menu.", "restaurant_nav"));
    }
    if (!hasReservationsAnchor) {
      issues.push(pathIssue("sections", "Restaurant nav must include /#reservations.", "restaurant_nav"));
    }

    const forbidden = header.copy.links.find((link) => ["features", "pricing"].includes(link.label.trim().toLowerCase()));
    if (forbidden) {
      issues.push(pathIssue("sections", `Restaurant nav contains forbidden label '${forbidden.label}'.`, "restaurant_nav"));
    }
  }

  if (plan.cta.primary.label !== "Book a Table" || plan.cta.primary.href !== "/#reservations") {
    issues.push(pathIssue("cta.primary", "Restaurant primary CTA must be 'Book a Table' with '/#reservations'.", "restaurant_cta"));
  }

  if (plan.cta.secondary.label !== "View Menu" || plan.cta.secondary.href !== "/#menu") {
    issues.push(pathIssue("cta.secondary", "Restaurant secondary CTA must be 'View Menu' with '/#menu'.", "restaurant_cta"));
  }

  return issues;
};

const validateClinicNavigationAndCta = (plan: WebsitePlan): PlanValidationIssue[] => {
  const issues: PlanValidationIssue[] = [];
  const header = plan.sections.find(
    (section): section is Extract<WebsitePlan["sections"][number], { type: "header" }> => section.type === "header"
  );

  if (!header) {
    issues.push(pathIssue("sections", "Clinic plan requires a header section.", "clinic_nav"));
  } else {
    const labels = header.copy.links.map((link) => link.label.trim().toLowerCase());
    CLINIC_NAV_REQUIRED_LABELS.forEach((label) => {
      if (!labels.includes(label)) {
        issues.push(pathIssue("sections", `Clinic nav missing '${label}'.`, "clinic_nav"));
      }
    });

    const forbidden = header.copy.links.find((link) => ["features", "pricing"].includes(link.label.trim().toLowerCase()));
    if (forbidden) {
      issues.push(pathIssue("sections", `Clinic nav contains forbidden label '${forbidden.label}'.`, "clinic_nav"));
    }
  }

  if (!plan.cta.primary.label.toLowerCase().includes("book")) {
    issues.push(pathIssue("cta.primary.label", "Clinic primary CTA must be booking-oriented.", "clinic_cta"));
  }

  return issues;
};

const validateClinicCopyAndMedia = (plan: WebsitePlan): PlanValidationIssue[] => {
  const issues: PlanValidationIssue[] = [];
  const hero = plan.sections.find(
    (section): section is Extract<WebsitePlan["sections"][number], { type: "hero" }> => section.type === "hero"
  );

  if (!hero) {
    issues.push(pathIssue("sections", "Clinic plan requires a hero section.", "clinic_media"));
    return issues;
  }

  if (!hero.media.length || hero.media.some((item) => item.src.trim() === "")) {
    issues.push(pathIssue("sections", "Clinic hero must include non-empty media sources.", "clinic_media"));
  }

  const heroCopy = `${hero.copy.headline} ${hero.copy.subheadline}`.toLowerCase();
  if (!CLINIC_COPY_HINTS.some((hint) => heroCopy.includes(hint))) {
    issues.push(pathIssue("sections", "Clinic hero copy must use dental/clinic language.", "clinic_copy"));
  }

  const features = plan.sections.find(
    (section): section is Extract<WebsitePlan["sections"][number], { type: "features" }> => section.type === "features"
  );
  if (features) {
    const featuresText = [features.copy.title, ...features.copy.items.map((item) => `${item.title} ${item.description}`)]
      .join(" ")
      .toLowerCase();
    if (!CLINIC_COPY_HINTS.some((hint) => featuresText.includes(hint))) {
      issues.push(pathIssue("sections", "Clinic features must be dental-service specific.", "clinic_copy"));
    }
  }

  return issues;
};

const validateRestaurantMedia = (plan: WebsitePlan): PlanValidationIssue[] => {
  const issues: PlanValidationIssue[] = [];

  const hero = plan.sections.find(
    (section): section is Extract<WebsitePlan["sections"][number], { type: "hero" }> => section.type === "hero"
  );

  if (!hero) {
    issues.push(pathIssue("sections", "Restaurant plan requires hero media.", "restaurant_media"));
    return issues;
  }

  const heroImages = hero.media.filter((item) => item.role === "hero" && item.src.trim().length > 0);
  if (heroImages.length < 1) {
    issues.push(pathIssue("sections", "Restaurant hero must include at least one non-empty hero image src.", "restaurant_media"));
  }

  const allMedia = plan.sections.flatMap((section, sectionIndex) =>
    section.media.map((media, mediaIndex) => ({
      path: `sections.${sectionIndex}.media.${mediaIndex}`,
      media
    }))
  );

  const nonEmptySrcCount = allMedia.filter((entry) => entry.media.src.trim().length > 0).length;
  const gallerySection = plan.sections.find((section) => section.type === "feature_spotlight");
  if (!gallerySection && nonEmptySrcCount < 3) {
    issues.push(
      pathIssue(
        "sections",
        "Restaurant requires a gallery section or at least 3 media items with non-empty src.",
        "restaurant_media"
      )
    );
  }

  allMedia.forEach((entry) => {
    if (entry.media.src === "") {
      issues.push(pathIssue(`${entry.path}.src`, "Restaurant media src must not be empty.", "restaurant_media"));
    }

    const alt = entry.media.alt.toLowerCase();
    const hasRestaurantContext =
      alt.includes(plan.meta.brandName.toLowerCase()) ||
      RESTAURANT_ALT_HINTS.some((hint) => alt.includes(hint));
    if (!hasRestaurantContext) {
      issues.push(
        pathIssue(
          `${entry.path}.alt`,
          "Restaurant media alt must reference restaurant name or food/ambience context.",
          "restaurant_media"
        )
      );
    }
  });

  return issues;
};

const validateHeroMediaForAllVerticals = (plan: WebsitePlan): PlanValidationIssue[] => {
  const issues: PlanValidationIssue[] = [];
  const hero = plan.sections.find(
    (section): section is Extract<WebsitePlan["sections"][number], { type: "hero" }> => section.type === "hero"
  );

  if (!hero) {
    issues.push(pathIssue("sections", "Plan requires a hero section with media.", "media_required"));
    return issues;
  }

  const nonEmptyHeroMedia = hero.media.filter((media) => media.src.trim().length > 0);
  if (nonEmptyHeroMedia.length < 1) {
    issues.push(pathIssue("sections", "Hero requires at least one media item with non-empty src.", "media_required"));
  }

  plan.sections.forEach((section, sectionIndex) => {
    section.media.forEach((media, mediaIndex) => {
      if (!media.src.trim()) {
        issues.push(
          pathIssue(
            `sections.${sectionIndex}.media.${mediaIndex}.src`,
            "Media src must not be empty.",
            "media_required"
          )
        );
      }
    });
  });

  return issues;
};

const validateNonSaasNavigation = (plan: WebsitePlan, rawPrompt: string): PlanValidationIssue[] => {
  if (plan.meta.vertical === "saas") {
    return [];
  }

  const header = plan.sections.find(
    (section): section is Extract<WebsitePlan["sections"][number], { type: "header" }> => section.type === "header"
  );
  if (!header) return [];
  const headerIndex = plan.sections.findIndex((section) => section.id === header.id);

  const issues: PlanValidationIssue[] = [];
  header.copy.links.forEach((link, index) => {
    const normalized = link.label.trim().toLowerCase();
    if (normalized === "features") {
      issues.push(
        pathIssue(
          `sections.${headerIndex}.copy.links.${index}.label`,
          "Non-SaaS navigation must not include 'Features'.",
          "nav_guardrail"
        )
      );
    }
    if (normalized === "pricing" && !promptExplicitlyRequestsPricing(rawPrompt)) {
      issues.push(
        pathIssue(
          `sections.${headerIndex}.copy.links.${index}.label`,
          "Non-SaaS navigation must not include 'Pricing' unless explicitly requested.",
          "nav_guardrail"
        )
      );
    }
  });

  return issues;
};

const validateBusinessRules = (plan: WebsitePlan, rawPrompt: string, intake?: IntakeBrief): PlanValidationIssue[] => {
  const issues: PlanValidationIssue[] = [];
  const sectionTypes = plan.sections.map((section) => section.type);

  sectionTypes.forEach((type, index) => {
    if (!SECTION_TYPES.includes(type)) {
      issues.push(pathIssue(`sections.${index}.type`, `Unknown section type '${type}'.`, "allowlist"));
    }
  });

  issues.push(...validateHeroMediaForAllVerticals(plan));
  issues.push(...validateNonSaasNavigation(plan, rawPrompt));

  if (sectionTypes[0] !== "header") {
    issues.push(pathIssue("sections.0.type", "Header must be the first section.", "order"));
  }

  if (sectionTypes[1] !== "hero") {
    issues.push(pathIssue("sections.1.type", "Hero must be the first content section after header.", "order"));
  }

  if (sectionTypes[sectionTypes.length - 1] !== "footer") {
    issues.push(pathIssue(`sections.${sectionTypes.length - 1}.type`, "Footer must be the last section.", "order"));
  }

  const allowed = new Set(allowedSectionsByVertical[plan.meta.vertical]);
  sectionTypes.forEach((type, index) => {
    const isRestaurantPricingException =
      plan.meta.vertical === "restaurant" &&
      type === "pricing" &&
      (intake?.allowPricingForRestaurant ?? promptExplicitlyRequestsPricing(rawPrompt));
    if (!allowed.has(type) && !isRestaurantPricingException) {
      issues.push(pathIssue(`sections.${index}.type`, `Section type '${type}' is not allowed for vertical '${plan.meta.vertical}'.`, "allowlist"));
    }
  });

  if (plan.meta.vertical === "restaurant") {
    issues.push(...validateRestaurantOrder(sectionTypes));

    const includesPricing = sectionTypes.includes("pricing");
    const allowRestaurantPricing = intake?.allowPricingForRestaurant ?? promptExplicitlyRequestsPricing(rawPrompt);
    if (includesPricing && !allowRestaurantPricing) {
      issues.push(
        pathIssue(
          "sections",
          "Pricing is forbidden for restaurant vertical unless onboarding explicitly requests online store/plans.",
          "pricing_guardrail"
        )
      );
    }

    const features = plan.sections.find(
      (section): section is Extract<WebsitePlan["sections"][number], { type: "features" }> => section.type === "features"
    );
    if (features) {
      const forbiddenCopy = [features.copy.title, ...features.copy.items.map((item) => item.title)].find((value) =>
        value.toLowerCase().includes("why teams choose this")
      );
      if (forbiddenCopy) {
        issues.push(pathIssue("sections", "Restaurant features copy must be dish/ambience language, not SaaS team language.", "restaurant_copy"));
      }
    }

    const ctaBanner = plan.sections.find(
      (section): section is Extract<WebsitePlan["sections"][number], { type: "cta_banner" }> =>
        section.type === "cta_banner"
    );
    if (ctaBanner) {
      const label = ctaBanner.copy.ctaLabel.toLowerCase();
      const title = ctaBanner.copy.title.toLowerCase();
      const isAllowed = label.includes("book") || label.includes("menu") || title.includes("reserve") || title.includes("menu");
      if (!isAllowed) {
        issues.push(pathIssue("sections", "Restaurant CTA banner must be reservation/menu oriented.", "restaurant_cta"));
      }
    }

    issues.push(...validateRestaurantNavigationAndCta(plan));
    issues.push(...validateRestaurantMedia(plan));

    if (!isRestaurantFontAllowed(plan.theme.font)) {
      issues.push(
        pathIssue(
          "theme.font",
          "Restaurant vertical does not allow mono font. Allowed fonts: serif or sans.",
          "theme"
        )
      );
    }
  } else if (plan.meta.vertical === "clinic") {
    const includesPricing = sectionTypes.includes("pricing");
    if (includesPricing && !promptExplicitlyRequestsPricing(rawPrompt)) {
      issues.push(
        pathIssue("sections", "Pricing is forbidden for clinic vertical unless explicitly requested.", "pricing_guardrail")
      );
    }

    issues.push(...validateClinicNavigationAndCta(plan));
    issues.push(...validateClinicCopyAndMedia(plan));

    if (plan.theme.font === "mono") {
      issues.push(pathIssue("theme.font", "Clinic vertical does not allow mono font.", "theme"));
    }
  } else {
    const expectedOrder = defaultOrderByVertical[plan.meta.vertical].filter((type) => sectionTypes.includes(type));
    issues.push(...compareOrderWithAllowedSwap(sectionTypes, expectedOrder));
  }

  const includesPricing = sectionTypes.includes("pricing");
  if (
    includesPricing &&
    plan.meta.vertical !== "saas" &&
    plan.meta.vertical !== "restaurant" &&
    !promptExplicitlyRequestsPricing(rawPrompt)
  ) {
    issues.push(
      pathIssue(
        "sections",
        "Pricing is allowed only for 'saas' or explicit prompt request.",
        "pricing_guardrail"
      )
    );
  }

  const metricsSection = plan.sections.find(
    (section): section is Extract<WebsitePlan["sections"][number], { type: "metrics" }> =>
      section.type === "metrics"
  );
  if (metricsSection) {
    const promptHasMetrics = promptLikelyContainsRealMetrics(rawPrompt);
    const deceptiveValues = metricsSection.copy.items.filter((item) => /\d+\s?(%|x)/i.test(item.value));

    if (!promptHasMetrics && deceptiveValues.length > 0) {
      issues.push(
        pathIssue(
          "sections",
          "Metrics cannot contain '%' or 'x' multipliers unless prompt explicitly provides real metrics.",
          "metrics_guardrail"
        )
      );
    }
  }

  const allLabels = [
    plan.cta.primary.label,
    plan.cta.secondary.label,
    ...plan.sections.flatMap((section) => {
      const labels = section.ctas.map((cta) => cta.label);
      if (section.type === "hero") {
        labels.push(section.copy.primaryCtaLabel, section.copy.secondaryCtaLabel);
      }
      if (section.type === "cta_banner") {
        labels.push(section.copy.ctaLabel);
      }
      return labels;
    })
  ];

  allLabels.forEach((label, index) => {
    const normalized = label.trim().toLowerCase();
    if (!normalized) return;

    if (["contact team", "book a call"].includes(normalized) && plan.meta.vertical === "restaurant") {
      issues.push(pathIssue(`cta.labels.${index}`, `CTA label '${label}' is not allowed for restaurant vertical.`, "restaurant_cta"));
      return;
    }

    if (!BANNED_CTA_LABELS.includes(normalized as (typeof BANNED_CTA_LABELS)[number])) {
      return;
    }

    if (hasExplicitGenericLabelRequest(rawPrompt, normalized)) {
      return;
    }

    issues.push(
      pathIssue(`cta.labels.${index}`, `CTA label '${label}' is banned unless explicitly requested.`, "cta_label")
    );
  });

  issues.push(...validateBannedPhrases(plan));

  return issues;
};

export const isCopyStyleIssue = (issue: PlanValidationIssue) => {
  return issue.code === "banned_phrase" || issue.code === "restaurant_copy" || issue.code === "restaurant_cta";
};

export const isCopyOnlyValidationFailure = (issues: PlanValidationIssue[]) => {
  return issues.length > 0 && issues.every((issue) => isCopyStyleIssue(issue));
};

export const formatIssuesForRetryFeedback = (issues: PlanValidationIssue[]) =>
  issues.map((issue) => `${issue.path}: ${issue.message}`);

export const formatCopyStyleIssuesForRetryFeedback = (
  issues: PlanValidationIssue[],
  context: { vertical: WebsitePlan["meta"]["vertical"]; primaryGoal: WebsitePlan["meta"]["primaryGoal"] }
) => {
  const phraseRows = issues
    .filter((issue) => issue.offendingPhrase)
    .map((issue) => `${issue.path}: ${issue.offendingPhrase}`);

  return [
    "Retry reason: banned phrases/copy style only.",
    `Vertical: ${context.vertical}`,
    `PrimaryGoal: ${context.primaryGoal}`,
    phraseRows.length ? `BannedPhrases:\n${phraseRows.join("\n")}` : "BannedPhrases: none",
    `Paths:\n${issues.map((issue) => issue.path).join("\n")}`,
    "Instruction: replace only the offending strings and keep all structure identical."
  ];
};

export function validatePlanWithBusinessRules(
  plan: unknown,
  rawPrompt: string,
  intake?: IntakeBrief
): { ok: true; value: WebsitePlan } | { ok: false; errors: PlanValidationIssue[] } {
  const schemaResult = validateWebsitePlan(plan);
  if (!schemaResult.ok) {
    return {
      ok: false,
      errors: schemaResult.errors.map(mapSchemaIssue)
    };
  }

  return {
    ok: true,
    value: schemaResult.value
  };
}
