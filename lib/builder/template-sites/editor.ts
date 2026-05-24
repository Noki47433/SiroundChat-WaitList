import type { CSSProperties } from "react";
import type {
  IntegratedTemplateEditorSettings,
  IntegratedTemplateSiteDocument,
  RestaurantTemplateContent
} from "@/lib/builder/template-sites/schema";

type DeterministicEditResult = {
  content: RestaurantTemplateContent;
  editorSettings: IntegratedTemplateEditorSettings;
  appliedChanges: string[];
  shouldRunAiRefinement: boolean;
  targetSection: SectionKey | null;
  isRepairRequest: boolean;
  requiresMaterialChange: boolean;
};

export type SectionKey =
  | "header"
  | "hero"
  | "story"
  | "highlights"
  | "experience"
  | "gallery"
  | "faq"
  | "menu"
  | "contact"
  | "reservation"
  | "footer"
  | "vision"
  | "location"
  | "editorial"
  | "testimonials";

const REPAIR_REQUEST_RE =
  /\b(fix|repair|broken|break|redo|rework|rewrite|regenerate|replace|overhaul|clean up|cleanup|bad|wrong|issue|problem)\b/i;
const MATERIAL_CHANGE_RE =
  /\b(fix|repair|broken|change|update|make|rewrite|regenerate|replace|remove|add|improve|expand|shorter|longer|stronger|premium|luxury|center|spacing|dark|light|white|black|red|show|hide|turn off|turn on)\b/i;

const COLOR_MAP: Record<string, string> = {
  white: "#ffffff",
  black: "#111111",
  red: "#ef4444",
  dark: "#111111",
  charcoal: "#111111",
  gray: "#374151",
  grey: "#374151"
};

const normalizeHexColor = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(trimmed)) return trimmed;
  return COLOR_MAP[trimmed.toLowerCase()] ?? null;
};

const hexToRgb = (value?: string | null) => {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  const hex = normalized.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
};

const withAlpha = (value: string, alpha: number) => {
  const rgb = hexToRgb(value);
  if (!rgb) return value;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const quotedText = (value: string) => {
  const match = value.match(/["']([^"']+)["']/);
  return match?.[1]?.trim() || null;
};

const normalizeSentence = (value?: string | null) => {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const ensureQuestion = (value?: string | null) => {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.endsWith("?") ? normalized : `${normalized}?`;
};

const buildFaqRepair = (content: RestaurantTemplateContent) => {
  const name = content.business.name;
  const cuisine = content.business.cuisine.toLowerCase();
  const concept = normalizeSentence(content.business.concept).replace(/[.?!]$/, "");
  const vibe = content.business.vibe.toLowerCase();
  const location = content.contact.addressLines[0] ?? content.business.locationLabel;
  const hours = content.contact.hours.join(", ");
  const reservationLabel = content.reservation.primaryLabel.toLowerCase();

  return {
    heading: "Frequently asked questions",
    items: [
      {
        question: ensureQuestion(`Do I need a reservation at ${name}`),
        answer: normalizeSentence(
          `${name} recommends reservations for peak lunch and dinner periods. Use the ${reservationLabel} option to secure preferred seating and add notes for celebrations or timing requests`
        )
      },
      {
        question: ensureQuestion(`What kind of dining experience does ${name} offer`),
        answer: normalizeSentence(
          `${name} serves ${cuisine} in a ${vibe} setting shaped around ${concept}, with service paced for date nights, celebrations, and longer evening meals`
        )
      },
      {
        question: ensureQuestion(`Where is ${name} located and when are you open`),
        answer: normalizeSentence(
          `${name} is located in ${location}. Current service hours are ${hours || "available directly from the team"}, and the staff can confirm same-day availability by phone or email`
        )
      },
      {
        question: ensureQuestion(`Can you help with groups, celebrations, or dietary requests`),
        answer: normalizeSentence(
          `The team can guide guests through larger-table planning, celebration details, and practical dietary questions before arrival so the visit feels properly coordinated`
        )
      }
    ]
  } satisfies RestaurantTemplateContent["faq"];
};

const buildStoryRepair = (content: RestaurantTemplateContent) => {
  const name = content.business.name;
  const cuisine = content.business.cuisine;
  const concept = normalizeSentence(content.business.concept).replace(/[.?!]$/, "");
  const vibe = content.business.vibe.toLowerCase();

  return {
    ...content.story,
    heading: content.story.heading || "Our story",
    description: normalizeSentence(
      `${name} brings ${cuisine.toLowerCase()} dining into a ${vibe} room shaped around ${concept}`
    ),
    paragraphs: [
      normalizeSentence(
        `${name} was built to give guests a clearer sense of pace, hospitality, and atmosphere from the first course to the final round of service`
      ),
      normalizeSentence(
        `${concept} guides the menu, but the experience is equally focused on how the room feels: calm, polished, and easy to return to for dinners, celebrations, and extended evenings`
      ),
      normalizeSentence(
        `Every touchpoint is meant to support a complete visit, from a stronger arrival impression to better table planning and more confident recommendations from the team`
      )
    ]
  };
};

const buildReservationRepair = (content: RestaurantTemplateContent) => {
  const name = content.business.name;
  const location = content.contact.addressLines[0] ?? content.business.locationLabel;

  return {
    ...content.reservation,
    eyebrow: "Reservations",
    heading: `Plan your table at ${name}`,
    description: normalizeSentence(
      `${name} welcomes date nights, client dinners, and celebrations in ${location}. Reserve ahead to secure the best timing, add guest notes, and let the team prepare service properly`
    )
  };
};

const buildContactRepair = (content: RestaurantTemplateContent) => {
  const location = content.contact.addressLines.join(", ");
  const hours = content.contact.hours.join(", ");

  return {
    ...content.contact,
    heading: "Visit and contact",
    description: normalizeSentence(
      `Find the restaurant in ${location}. Use the direct phone or email details below for reservation follow-up, dining questions, and service timing, and check current hours before arrival: ${hours}`
    )
  };
};

const cloneContent = (content: RestaurantTemplateContent): RestaurantTemplateContent => ({
  ...content,
  hero: { ...content.hero },
  story: {
    ...content.story,
    paragraphs: [...content.story.paragraphs],
    principles: content.story.principles.map((item) => ({ ...item }))
  },
  highlights: {
    ...content.highlights,
    items: content.highlights.items.map((item) => ({ ...item }))
  },
  experience: {
    ...content.experience,
    items: content.experience.items.map((item) => ({ ...item }))
  },
  dishes: {
    ...content.dishes,
    items: content.dishes.items.map((item) => ({ ...item }))
  },
  faq: {
    ...content.faq,
    items: content.faq.items.map((item) => ({ ...item }))
  },
  menu: content.menu
    ? {
        ...content.menu,
        categories: content.menu.categories.map((category) => ({
          ...category,
          items: category.items.map((item) => ({ ...item }))
        }))
      }
    : undefined,
  reservation: { ...content.reservation },
  contact: {
    ...content.contact,
    addressLines: [...content.contact.addressLines],
    hours: [...content.contact.hours]
  },
  footer: {
    ...content.footer,
    links: content.footer.links.map((item) => ({ ...item }))
  },
  imageBriefs: {
    hero: { ...content.imageBriefs.hero },
    story: content.imageBriefs.story ? { ...content.imageBriefs.story } : undefined,
    location: content.imageBriefs.location ? { ...content.imageBriefs.location } : undefined,
    highlights: content.imageBriefs.highlights.map((item) => ({ ...item })),
    dishes: content.imageBriefs.dishes.map((item) => ({ ...item })),
    gallery: content.imageBriefs.gallery.map((item) => ({ ...item }))
  },
  business: { ...content.business }
});

const mergeEditorSettings = (
  current: IntegratedTemplateEditorSettings | undefined,
  patch: IntegratedTemplateEditorSettings
): IntegratedTemplateEditorSettings => ({
  colors: {
    ...(current?.colors ?? {}),
    ...(patch.colors ?? {})
  },
  typography: {
    ...(current?.typography ?? {}),
    ...(patch.typography ?? {})
  },
  layout: {
    ...(current?.layout ?? {}),
    ...(patch.layout ?? {}),
    sectionVisibility: {
      ...(current?.layout?.sectionVisibility ?? {}),
      ...(patch.layout?.sectionVisibility ?? {})
    },
    sectionStyles: {
      ...(current?.layout?.sectionStyles ?? {}),
      ...(patch.layout?.sectionStyles ?? {})
    }
  }
});

const mergeSectionStyle = (
  current: IntegratedTemplateEditorSettings,
  section: SectionKey,
  patch: NonNullable<
    NonNullable<IntegratedTemplateEditorSettings["layout"]>["sectionStyles"]
  >[string]
) =>
  mergeEditorSettings(current, {
    layout: {
      sectionStyles: {
        [section]: {
          ...(current.layout?.sectionStyles?.[section] ?? {}),
          ...patch
        }
      }
    }
  });

const extractColorAfterKeyword = (prompt: string, keyword: string) => {
  const regex = new RegExp(`${keyword}\\s+(#[0-9a-fA-F]{3,6}|white|black|red|dark|charcoal|gray|grey)`, "i");
  const match = prompt.match(regex);
  return normalizeHexColor(match?.[1] ?? null);
};

const extractSectionColor = (
  prompt: string,
  section: SectionKey,
  surface: "text" | "background"
) => {
  const tokens = "#[0-9a-fA-F]{3,6}|white|black|red|dark|charcoal|gray|grey";
  const regexes =
    surface === "text"
      ? [
          new RegExp(`${section}[^\\n]{0,48}?text[^\\n]{0,24}?(${tokens})`, "i"),
          new RegExp(`${section}[^\\n]{0,48}?(${tokens})`, "i")
        ]
      : [
          new RegExp(`${section}[^\\n]{0,48}?background[^\\n]{0,24}?(${tokens})`, "i")
        ];

  for (const regex of regexes) {
    const match = prompt.match(regex);
    const resolved = normalizeHexColor(match?.[1] ?? null);
    if (resolved) return resolved;
  }

  return null;
};

const resolveSectionKey = (prompt: string): SectionKey | null => {
  const normalized = prompt.toLowerCase();
  const map: Array<[SectionKey, string[]]> = [
    ["header", ["header", "navigation", "nav"]],
    ["hero", ["hero"]],
    ["story", ["story", "about", "philosophy"]],
    ["highlights", ["highlight", "highlights", "signature"]],
    ["experience", ["experience"]],
    ["gallery", ["gallery"]],
    ["faq", ["faq", "frequently asked questions", "frequently asked", "common questions"]],
    ["menu", ["menu"]],
    ["contact", ["contact"]],
    ["reservation", ["reservation", "reserve"]],
    ["footer", ["footer"]],
    ["vision", ["vision"]],
    ["location", ["location"]],
    ["editorial", ["editorial"]],
    ["testimonials", ["testimonial", "testimonials", "review", "reviews"]]
  ];

  for (const [section, keywords] of map) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return section;
    }
  }
  return null;
};

export const inferIntegratedTemplateEditIntent = (prompt: string) => {
  const normalized = prompt.trim().toLowerCase();
  const targetSection = resolveSectionKey(normalized);
  const isRepairRequest = REPAIR_REQUEST_RE.test(normalized);
  const requiresMaterialChange =
    MATERIAL_CHANGE_RE.test(normalized) || Boolean(targetSection);

  return {
    targetSection,
    isRepairRequest,
    requiresMaterialChange
  };
};

const shouldUseAiRefinement = (prompt: string, deterministicChanges: string[]) => {
  const normalized = prompt.toLowerCase();
  if (!deterministicChanges.length) return true;
  const hasSectionRepair = deterministicChanges.some(
    (change) =>
      change.endsWith("_rebuilt") ||
      change.endsWith("_repaired") ||
      change.endsWith("_readability")
  );
  if (
    hasSectionRepair &&
    /\b(fix|repair|broken|problem|issue|bad|wrong|cleanup|clean up)\b/.test(normalized) &&
    !/\b(refine|rewrite|expand|tone|premium|luxury|warmer|colder|shorter|longer|stronger)\b/.test(
      normalized
    )
  ) {
    return false;
  }
  return /\b(rewrite|refine|improve|expand|add|shorter|longer|stronger|premium|luxury|tone|copy|story|section)\b/.test(
    normalized
  ) && !/\b(hero text|hero title|hero headline|hero subtitle|subheadline|make text|make button|make background|center text|increase spacing|decrease spacing|hide |show |turn off |turn on )\b/.test(
    normalized
  );
};

export const isSectionEnabled = (
  settings: IntegratedTemplateEditorSettings | undefined,
  key: string
) => settings?.layout?.sectionVisibility?.[key] !== false;

export const getSectionEditorStyle = (
  template: IntegratedTemplateSiteDocument["template"],
  settings: IntegratedTemplateEditorSettings | undefined,
  key: string
): CSSProperties | undefined => {
  const sectionStyle = settings?.layout?.sectionStyles?.[key];
  if (!sectionStyle?.textColor && !sectionStyle?.backgroundColor) return undefined;

  const next: Record<string, string> = {};

  if (sectionStyle.backgroundColor) {
    next.backgroundColor = sectionStyle.backgroundColor;
  }

  if (sectionStyle.textColor) {
    next["--site-editor-text-color"] = sectionStyle.textColor;
    next["--site-editor-hero-text-color"] = sectionStyle.textColor;
    next["--site-text"] = sectionStyle.textColor;
    next["--site-text-soft"] = withAlpha(sectionStyle.textColor, 0.82);
    next["--site-text-faint"] = withAlpha(sectionStyle.textColor, 0.55);
    next["--site-muted"] = withAlpha(sectionStyle.textColor, 0.72);
    next["--site-border"] = withAlpha(sectionStyle.textColor, 0.16);

    switch (template) {
      case "evasion":
        next["--evasion-text"] = sectionStyle.textColor;
        next["--evasion-muted"] = withAlpha(sectionStyle.textColor, 0.72);
        break;
      case "essence":
        next["--essence-foreground"] = sectionStyle.textColor;
        next["--essence-muted"] = withAlpha(sectionStyle.textColor, 0.72);
        break;
      case "hously":
        next["--hously-foreground"] = sectionStyle.textColor;
        next["--hously-muted"] = withAlpha(sectionStyle.textColor, 0.72);
        next["--hously-border"] = withAlpha(sectionStyle.textColor, 0.16);
        break;
      case "food-truck":
        next["--ft-text"] = sectionStyle.textColor;
        next["--ft-muted"] = withAlpha(sectionStyle.textColor, 0.72);
        break;
      default:
        break;
    }
  }

  return next as CSSProperties;
};

export const applyDeterministicIntegratedTemplateEdit = (
  document: IntegratedTemplateSiteDocument,
  prompt: string
): DeterministicEditResult => {
  const normalized = prompt.trim();
  const lower = normalized.toLowerCase();
  const nextContent = cloneContent(document.content);
  let nextSettings = mergeEditorSettings(document.editorSettings, {});
  const appliedChanges: string[] = [];
  const quoted = quotedText(normalized);
  const { targetSection, isRepairRequest, requiresMaterialChange } =
    inferIntegratedTemplateEditIntent(normalized);

  if (quoted && /\b(hero text|hero title|hero headline)\b/i.test(lower)) {
    nextContent.hero.headline = quoted;
    appliedChanges.push("hero_headline");
  }

  if (quoted && /\b(hero subtitle|hero subheadline|subheadline)\b/i.test(lower)) {
    nextContent.hero.subheadline = quoted;
    appliedChanges.push("hero_subheadline");
  }

  if (quoted && /\b(story|about|philosophy) text\b/i.test(lower)) {
    nextContent.story.description = quoted;
    nextContent.story.paragraphs[0] = quoted;
    appliedChanges.push("story_text");
  }

  if (quoted && /\b(reservation|reserve) text\b/i.test(lower)) {
    nextContent.reservation.description = quoted;
    appliedChanges.push("reservation_text");
  }

  if (quoted && /\b(contact) text\b/i.test(lower)) {
    nextContent.contact.description = quoted;
    appliedChanges.push("contact_text");
  }

  if (quoted && /\b(faq|frequently asked questions?) (title|heading)\b/i.test(lower)) {
    nextContent.faq.heading = quoted;
    appliedChanges.push("faq_heading");
  }

  const heroTextColor = /\bhero\b/i.test(lower)
    ? extractColorAfterKeyword(lower, "white all") ??
      extractColorAfterKeyword(lower, "black all") ??
      extractColorAfterKeyword(lower, "text") ??
      extractColorAfterKeyword(lower, "hero text") ??
      (lower.includes("white") ? "#ffffff" : lower.includes("black") ? "#111111" : null)
    : null;
  if (heroTextColor && /\b(hero text|hero title|hero headline)\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      colors: { heroTextColor }
    });
    appliedChanges.push("hero_text_color");
  }

  const globalTextColor =
    extractColorAfterKeyword(lower, "make text") ??
    (/\ball white\b/i.test(lower) ? "#ffffff" : /\ball black\b/i.test(lower) ? "#111111" : null);
  if (globalTextColor) {
    nextSettings = mergeEditorSettings(nextSettings, {
      colors: { textColor: globalTextColor }
    });
    appliedChanges.push("text_color");
  }

  const buttonColor = extractColorAfterKeyword(lower, "make button");
  if (buttonColor) {
    nextSettings = mergeEditorSettings(nextSettings, {
      colors: { secondaryColor: buttonColor }
    });
    appliedChanges.push("button_color");
  }

  if (/\bmake background dark\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      colors: { primaryColor: "#111111" }
    });
    appliedChanges.push("background_dark");
  }

  if (/\bcenter text\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      typography: { alignment: "center" }
    });
    appliedChanges.push("text_align_center");
  }

  if (/\bincrease spacing\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      layout: { spacing: "relaxed" }
    });
    appliedChanges.push("spacing_relaxed");
  }

  if (/\bdecrease spacing\b/i.test(lower) || /\btighten spacing\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      layout: { spacing: "compact" }
    });
    appliedChanges.push("spacing_compact");
  }

  if (/\b(increase|larger|bigger) hero (text|title|headline|size)\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      typography: { heroSize: "lg" }
    });
    appliedChanges.push("hero_size_large");
  }

  if (/\b(decrease|smaller) hero (text|title|headline|size)\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      typography: { heroSize: "sm" }
    });
    appliedChanges.push("hero_size_small");
  }

  if (/\b(increase|larger|bigger) body (text|copy|size)\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      typography: { bodySize: "lg" }
    });
    appliedChanges.push("body_size_large");
  }

  if (/\b(decrease|smaller) body (text|copy|size)\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      typography: { bodySize: "sm" }
    });
    appliedChanges.push("body_size_small");
  }

  if (targetSection) {
    const sectionTextColor = extractSectionColor(lower, targetSection, "text");
    if (sectionTextColor) {
      nextSettings = mergeSectionStyle(nextSettings, targetSection, {
        textColor: sectionTextColor
      });
      appliedChanges.push(`${targetSection}_text_color`);
    }

    const sectionBackgroundColor = extractSectionColor(lower, targetSection, "background");
    if (sectionBackgroundColor) {
      nextSettings = mergeSectionStyle(nextSettings, targetSection, {
        backgroundColor: sectionBackgroundColor
      });
      appliedChanges.push(`${targetSection}_background_color`);
    }
  }

  if (targetSection === "faq" && isRepairRequest) {
    nextContent.faq = buildFaqRepair(nextContent);
    nextSettings = mergeSectionStyle(nextSettings, "faq", {
      textColor: "#1b1712",
      backgroundColor: "#f3eadc"
    });
    appliedChanges.push("faq_rebuilt");
    appliedChanges.push("faq_readability");
  }

  if (targetSection === "story" && isRepairRequest) {
    nextContent.story = buildStoryRepair(nextContent);
    appliedChanges.push("story_rebuilt");
  }

  if (targetSection === "reservation" && isRepairRequest) {
    nextContent.reservation = buildReservationRepair(nextContent);
    appliedChanges.push("reservation_rebuilt");
  }

  if (targetSection === "contact" && isRepairRequest) {
    nextContent.contact = buildContactRepair(nextContent);
    appliedChanges.push("contact_rebuilt");
  }

  if (targetSection && /\b(hide|remove|turn off|disable)\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      layout: {
        sectionVisibility: {
          [targetSection]: false
        }
      }
    });
    appliedChanges.push(`hide_${targetSection}`);
  }

  if (targetSection && /\b(show|turn on|enable)\b/i.test(lower)) {
    nextSettings = mergeEditorSettings(nextSettings, {
      layout: {
        sectionVisibility: {
          [targetSection]: true
        }
      }
    });
    appliedChanges.push(`show_${targetSection}`);
  }

  return {
    content: nextContent,
    editorSettings: nextSettings,
    appliedChanges,
    shouldRunAiRefinement: shouldUseAiRefinement(normalized, appliedChanges),
    targetSection,
    isRepairRequest,
    requiresMaterialChange
  };
};
