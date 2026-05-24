import type OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { describePalette } from "@/lib/builder/template-sites/palette";
import {
  RestaurantTemplateContentSchema,
  type IntegratedTemplateId,
  type RestaurantTemplateContent
} from "@/lib/builder/template-sites/schema";
import { getThemeStyleOption, type ThemeStyleId } from "@/lib/builder/template-sites/themes";

type RestaurantGenerationContext = {
  prompt: string;
  rawPrompt?: string | null;
  businessName: string;
  industry: string;
  template: IntegratedTemplateId;
  themeStyle?: ThemeStyleId | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  contact?: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  openingHours?: string | null;
  socials?: Record<string, string | null> | null;
};

const MODEL = "gpt-4o-mini";
const THINK_MODEL = "gpt-4o";

const TEMPLATE_DIRECTIONS: Record<IntegratedTemplateId, string> = {
  evasion: "Cinematic, bold, premium, darker restaurant framing. Strong hero, confident highlights, dramatic reservation CTA.",
  essence: "Elegant editorial fine-dining framing. Refined story, chef-led positioning, tasting-menu language, polished reservation/contact copy.",
  hously: "Modern, minimal, calm restaurant framing. Clean copy, restrained tone, contemporary dining experience, clear FAQ/reservation.",
  "food-truck":
    "Casual, practical restaurant framing. Concise menu-led copy, comfort-food tone, clear location/contact/reservation prompts."
};

const TEMPLATE_COMPLETENESS_RULES: Record<IntegratedTemplateId, string> = {
  evasion:
    "Provide 6 highlight cards, 4 experience notes, 4 gallery image briefs, and 3-4 signature dishes so the dramatic sections feel full.",
  essence:
    "Provide 4 principles, 4 experience steps, 3 signature dishes, and layered reservation/contact copy so the editorial layout feels complete.",
  hously:
    "Provide 4 highlights, 4 experience items, 4 FAQs, and enough story detail for the minimal layout to feel intentional rather than sparse.",
  "food-truck":
    "Provide 4 menu categories with multiple items, a strong promo block, practical location/contact copy, and enough casual restaurant detail to fill the page."
};

const CONTENT_SHAPE_GUIDE = JSON.stringify(
  {
    business: {
      name: "Business name",
      cuisine: "Cuisine style",
      concept: "Short concept",
      vibe: "Atmosphere",
      locationLabel: "Neighborhood or location label",
      shortWordmark: "SHORTWORD"
    },
    hero: {
      eyebrow: "Short eyebrow",
      headline: "Main headline",
      subheadline: "Hero supporting sentence",
      primaryCtaLabel: "Primary CTA",
      primaryCtaHref: "#reserve",
      secondaryCtaLabel: "Secondary CTA",
      secondaryCtaHref: "#menu"
    },
    story: {
      heading: "Story heading",
      description: "Short story description",
      paragraphs: ["Paragraph one", "Paragraph two"],
      principles: [
        { title: "Principle one", description: "Description one" },
        { title: "Principle two", description: "Description two" },
        { title: "Principle three", description: "Description three" }
      ]
    },
    highlights: {
      heading: "Highlights heading",
      description: "Highlights description",
      items: [
        { title: "Highlight one", subtitle: "Optional subtitle", description: "Description", price: "$24" },
        { title: "Highlight two", description: "Description" },
        { title: "Highlight three", description: "Description" }
      ]
    },
    experience: {
      heading: "Experience heading",
      description: "Experience description",
      items: [
        { title: "Experience item", description: "Description", note: "Optional note" },
        { title: "Experience item", description: "Description" },
        { title: "Experience item", description: "Description" }
      ]
    },
    dishes: {
      heading: "Dishes heading",
      note: "Short note",
      items: [
        { title: "Dish one", subtitle: "Optional subtitle", description: "Description", price: "$18" },
        { title: "Dish two", description: "Description" },
        { title: "Dish three", description: "Description" }
      ]
    },
    faq: {
      heading: "FAQ heading",
      items: [
        { question: "Question one", answer: "Answer one" },
        { question: "Question two", answer: "Answer two" },
        { question: "Question three", answer: "Answer three" }
      ]
    },
    menu: {
      heading: "Menu heading",
      subheading: "Menu subheading",
      promoEyebrow: "Promo eyebrow",
      promoTitle: "Promo title",
      promoBody: "Promo body",
      categories: [
        { id: "category-1", label: "Category one", items: [{ title: "Item one", description: "Description", price: "$12" }] },
        { id: "category-2", label: "Category two", items: [{ title: "Item one", description: "Description", price: "$12" }] },
        { id: "category-3", label: "Category three", items: [{ title: "Item one", description: "Description", price: "$12" }] }
      ]
    },
    reservation: {
      eyebrow: "Reservation eyebrow",
      heading: "Reservation heading",
      description: "Reservation description",
      primaryLabel: "Primary button",
      primaryHref: "#reserve",
      secondaryLabel: "Secondary button",
      secondaryHref: "#contact"
    },
    contact: {
      heading: "Contact heading",
      description: "Contact description",
      addressLines: ["Address line 1", "Address line 2"],
      phone: "+1 555 010 0100",
      email: "hello@example.com",
      hours: ["Tue-Sun: 5pm-10pm"],
      socialLabel: "Instagram",
      socialHref: "https://instagram.com/example"
    },
    footer: {
      description: "Footer description",
      legalText: "Copyright text",
      links: [
        { label: "Menu", href: "#menu" },
        { label: "Reserve", href: "#reserve" },
        { label: "Contact", href: "#contact" }
      ]
    },
    imageBriefs: {
      hero: { query: "hero query", alt: "hero alt" },
      story: { query: "story query", alt: "story alt" },
      location: { query: "location query", alt: "location alt" },
      highlights: [{ query: "highlight query", alt: "highlight alt" }],
      dishes: [{ query: "dish query", alt: "dish alt" }],
      gallery: [{ query: "gallery query", alt: "gallery alt" }]
    }
  },
  null,
  2
);

const baseJsonInstruction = [
  "Return JSON only.",
  "Keep it concise and usable.",
  "Write in English.",
  "Do not invent unsupported sections.",
  "Do not use markdown."
].join(" ");

const SLOT_GUARDRAILS = [
  "Keep hero headline under 8 words.",
  "Keep hero subheadline under 24 words.",
  "Keep reservation heading under 7 words.",
  "Keep CTA labels under 4 words.",
  "Keep stat-like notes, prices, and short labels compact.",
  "Keep titles concise enough for premium editorial layouts.",
  "Image queries must be restaurant-specific and Pexels-friendly.",
  "Avoid costumes, cosplay, mascots, generic office scenes, and irrelevant portraits."
].join(" ");

const safeWordmark = (businessName: string) => {
  const token = businessName
    .trim()
    .split(/\s+/)[0]
    ?.replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  return token && token.length <= 18 ? token : businessName.slice(0, 18).toUpperCase();
};

const fallbackSocial = (socials?: Record<string, string | null> | null) => {
  const first = Object.entries(socials ?? {}).find(([, value]) => typeof value === "string" && value.trim().length > 0);
  if (!first) {
    return {
      socialLabel: "Instagram",
      socialHref: "https://instagram.com"
    };
  }
  return {
    socialLabel: first[0].replace(/^\w/, (token) => token.toUpperCase()),
    socialHref: first[1] ?? "https://instagram.com"
  };
};

const hydrateContent = (
  content: RestaurantTemplateContent,
  context: RestaurantGenerationContext
): RestaurantTemplateContent => {
  const social = fallbackSocial(context.socials);
  const addressLines = context.contact?.address
    ? context.contact.address.split(",").map((entry) => entry.trim()).filter(Boolean)
    : content.contact.addressLines;
  const hours = context.openingHours
    ? context.openingHours
        .split(/\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : content.contact.hours;

  return {
    ...content,
    business: {
      ...content.business,
      name: context.businessName,
      shortWordmark: safeWordmark(context.businessName)
    },
    contact: {
      ...content.contact,
      addressLines: addressLines.length ? addressLines.slice(0, 4) : content.contact.addressLines,
      email: context.contact?.email ?? content.contact.email,
      phone: context.contact?.phone ?? content.contact.phone,
      hours: hours.length ? hours.slice(0, 4) : content.contact.hours,
      socialLabel: social.socialLabel,
      socialHref: social.socialHref
    }
  };
};

const cloneContentItem = (
  item: RestaurantTemplateContent["highlights"]["items"][number],
  index: number
) => ({
  ...item,
  title: item.title,
  subtitle: item.subtitle ?? item.note ?? `Chef's selection ${index + 1}`,
  description: item.description,
  price: item.price,
  note: item.note,
  season: item.season,
  technique: item.technique,
  awards: item.awards
});

const clonePrinciple = (
  item: RestaurantTemplateContent["story"]["principles"][number],
  index: number
) => ({
  ...item,
  title: item.title,
  description: item.description || `Detail ${index + 1}`
});

const cloneExperienceItem = (
  item: RestaurantTemplateContent["experience"]["items"][number],
  index: number
) => ({
  ...item,
  title: item.title,
  description: item.description,
  note: item.note ?? `Service cue ${index + 1}`
});

const cloneFaqItem = (
  item: RestaurantTemplateContent["faq"]["items"][number],
  index: number
) => ({
  ...item,
  question: item.question,
  answer: item.answer || `Answer ${index + 1}`
});

const cloneMenuItem = (
  item: NonNullable<RestaurantTemplateContent["menu"]>["categories"][number]["items"][number]
) => ({
  ...item,
  title: item.title,
  description: item.description,
  price: item.price
});

const padArray = <T,>(items: T[], target: number, clone: (item: T, index: number) => T) => {
  if (!items.length) return items;
  const next = [...items];
  while (next.length < target) {
    next.push(clone(items[next.length % items.length], next.length));
  }
  return next.slice(0, target);
};

const buildImageBrief = (query: string, alt: string) => ({
  query,
  alt
});

const ensureTemplateDensity = (
  content: RestaurantTemplateContent,
  context: RestaurantGenerationContext
): RestaurantTemplateContent => {
  const targetCounts: Record<
    IntegratedTemplateId,
    { highlights: number; dishes: number; gallery: number; faq: number; principles: number; experience: number; categories: number }
  > = {
    evasion: { highlights: 6, dishes: 4, gallery: 6, faq: 4, principles: 4, experience: 4, categories: 4 },
    essence: { highlights: 4, dishes: 3, gallery: 4, faq: 4, principles: 4, experience: 4, categories: 4 },
    hously: { highlights: 4, dishes: 4, gallery: 4, faq: 4, principles: 4, experience: 4, categories: 4 },
    "food-truck": { highlights: 4, dishes: 4, gallery: 4, faq: 4, principles: 4, experience: 4, categories: 4 }
  };
  const targets = targetCounts[context.template];
  const baseHeroQuery = content.imageBriefs.hero.query;
  const baseHeroAlt = content.imageBriefs.hero.alt;

  const menuCategories =
    content.menu?.categories && content.menu.categories.length
      ? padArray(content.menu.categories, targets.categories, (category, index) => ({
          ...category,
          id: `${category.id || "category"}-${index + 1}`,
          label: category.label,
          items: padArray(category.items, 3, (item) => cloneMenuItem(item)).slice(0, 3)
        }))
      : undefined;

  return {
    ...content,
    story: {
      ...content.story,
      principles: padArray(content.story.principles, targets.principles, clonePrinciple)
    },
    highlights: {
      ...content.highlights,
      items: padArray(content.highlights.items, targets.highlights, cloneContentItem)
    },
    experience: {
      ...content.experience,
      items: padArray(content.experience.items, targets.experience, cloneExperienceItem)
    },
    dishes: {
      ...content.dishes,
      items: padArray(content.dishes.items, targets.dishes, cloneContentItem)
    },
    faq: {
      ...content.faq,
      items: padArray(content.faq.items, targets.faq, cloneFaqItem)
    },
    menu: content.menu
      ? {
          ...content.menu,
          categories: menuCategories ?? content.menu.categories
        }
      : undefined,
    imageBriefs: {
      hero: content.imageBriefs.hero,
      story:
        content.imageBriefs.story ??
        buildImageBrief(`${baseHeroQuery}, chef's table story detail`, `${baseHeroAlt} story image`),
      location:
        content.imageBriefs.location ??
        buildImageBrief(
          `${context.businessName} restaurant exterior or dining room entrance`,
          `${context.businessName} location`
        ),
      highlights: padArray(
        content.imageBriefs.highlights.length
          ? content.imageBriefs.highlights
          : [buildImageBrief(`${baseHeroQuery}, signature highlight dish`, `${context.businessName} highlight dish`)],
        Math.min(targets.highlights, 4),
        (brief, index) =>
          buildImageBrief(
            `${brief.query}, signature restaurant highlight ${index + 1}`,
            brief.alt
          )
      ),
      dishes: padArray(
        content.imageBriefs.dishes.length
          ? content.imageBriefs.dishes
          : [buildImageBrief(`${baseHeroQuery}, plated signature dish`, `${context.businessName} plated dish`)],
        Math.min(targets.dishes, 4),
        (brief, index) =>
          buildImageBrief(
            `${brief.query}, plated course ${index + 1}`,
            brief.alt
          )
      ),
      gallery: padArray(
        content.imageBriefs.gallery.length
          ? content.imageBriefs.gallery
          : [buildImageBrief(`${baseHeroQuery}, dining room ambiance`, `${context.businessName} dining room`)],
        Math.min(targets.gallery, 6),
        (brief, index) =>
          buildImageBrief(
            `${brief.query}, restaurant atmosphere ${index + 1}`,
            brief.alt
          )
      )
    }
  };
};

const countWords = (value?: string | null) =>
  (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const ensureSentence = (value?: string | null) => {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const uniqueParts = (parts: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  return parts
    .map((part) => ensureSentence(part))
    .filter((part) => {
      if (!part || seen.has(part)) return false;
      seen.add(part);
      return true;
    });
};

const buildDenseCopy = (
  value: string | null | undefined,
  minWords: number,
  fallbacks: Array<string | null | undefined>,
  fallbackText: string
) => {
  const parts = uniqueParts([value, ...fallbacks, fallbackText]);
  let combined = "";

  for (const part of parts) {
    combined = combined ? `${combined} ${part}` : part;
    if (countWords(combined) >= minWords) break;
  }

  return ensureSentence(combined || fallbackText);
};

const PROMPT_ECHO_PATTERNS = [
  /\bgenerate a website\b/i,
  /\bexisting business information\b/i,
  /\bcore offer\b/i,
  /\bcontact path\b/i,
  /\bcustomer trust\b/i,
  /\bmobile-friendly experience\b/i,
  /\bclear business information\b/i,
  /\beasy contact path\b/i,
  /^\s*prompt:/i,
  /^\s*instruction:/i,
  /^\s*emphasize\b/i
];

const isPromptEchoText = (value?: string | null) => {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return PROMPT_ECHO_PATTERNS.some((pattern) => pattern.test(normalized));
};

const sanitizePromptEchoCopy = (
  content: RestaurantTemplateContent,
  context: RestaurantGenerationContext
): RestaurantTemplateContent => {
  const cuisine = content.business.cuisine.toLowerCase();
  const vibe = content.business.vibe.toLowerCase();
  const concept = content.business.concept.toLowerCase();
  const baseBusinessSentence = `${context.businessName} brings ${cuisine} cooking into a ${vibe} dining experience shaped around ${concept}.`;
  const serviceSentence =
    "Guests should immediately understand the atmosphere, the signature dishes, and how to move from inspiration to a confident reservation.";
  const storyFallbacks = [
    `${context.businessName} is built for diners who want a room with personality, confident hospitality, and a menu that rewards a slower meal.`,
    `The story balances kitchen craft, polished service, and a sharper sense of occasion so the evening feels complete rather than transactional.`,
    `Private dining, celebrations, and standard reservations are all handled with the same calm attention to detail that shapes the rest of the experience.`
  ];

  const sanitizeText = (
    value: string | null | undefined,
    fallback: string
  ) => {
    if (isPromptEchoText(value)) return ensureSentence(fallback);
    return value ?? fallback;
  };

  return {
    ...content,
    hero: {
      ...content.hero,
      headline: sanitizeText(
        content.hero.headline,
        `${context.businessName} ${content.business.cuisine}`
      ),
      subheadline: sanitizeText(
        content.hero.subheadline,
        `${baseBusinessSentence} ${serviceSentence}`
      )
    },
    story: {
      ...content.story,
      heading: sanitizeText(content.story.heading, `The Story Of ${context.businessName}`),
      description: sanitizeText(
        content.story.description,
        `${baseBusinessSentence} ${serviceSentence}`
      ),
      paragraphs: content.story.paragraphs.map((paragraph, index) =>
        sanitizeText(paragraph, storyFallbacks[index] ?? storyFallbacks[storyFallbacks.length - 1])
      )
    },
    highlights: {
      ...content.highlights,
      heading: sanitizeText(content.highlights.heading, "Signature Highlights"),
      description: sanitizeText(
        content.highlights.description,
        "These highlights show the dishes, service touches, and room details that matter most to guests deciding whether to book."
      ),
      items: content.highlights.items.map((item) => ({
        ...item,
        description: sanitizeText(
          item.description,
          `${item.title} is presented as a signature moment with enough detail to feel restaurant-ready rather than generic filler.`
        )
      }))
    },
    experience: {
      ...content.experience,
      heading: sanitizeText(content.experience.heading, "The Experience"),
      description: sanitizeText(
        content.experience.description,
        "Service, pacing, and atmosphere work together so the full evening feels composed from the first arrival through the last course."
      ),
      items: content.experience.items.map((item) => ({
        ...item,
        description: sanitizeText(
          item.description,
          `${item.title} helps the evening feel paced, polished, and easier for guests to understand before they commit to a reservation.`
        )
      }))
    },
    dishes: {
      ...content.dishes,
      heading: sanitizeText(content.dishes.heading, "Signature Dishes"),
      note: sanitizeText(
        content.dishes.note,
        "These dishes are the clearest proof of the restaurant's point of view and should give diners enough confidence to reserve."
      ),
      items: content.dishes.items.map((item) => ({
        ...item,
        description: sanitizeText(
          item.description,
          `${item.title} adds depth to the menu with detail that feels guest-facing, specific, and ready for a first-pass website.`
        )
      }))
    },
    reservation: {
      ...content.reservation,
      heading: sanitizeText(content.reservation.heading, "Reserve Your Table"),
      description: sanitizeText(
        content.reservation.description,
        "Use this section to turn interest into action with clear expectations for standard bookings, celebrations, and higher-intent dining visits."
      )
    },
    contact: {
      ...content.contact,
      heading: sanitizeText(content.contact.heading, "Visit And Contact"),
      description: sanitizeText(
        content.contact.description,
        "Make it easy for guests to find the restaurant, confirm hours, and reach the team for reservations or event questions."
      )
    },
    footer: {
      ...content.footer,
      description: sanitizeText(
        content.footer.description,
        `${context.businessName} is designed for guests who want a clear sense of place, signature dishes, and a straightforward path to reserve.`
      )
    }
  };
};

const ensureEvasionDensity = (
  content: RestaurantTemplateContent
): RestaurantTemplateContent => {
  const [firstHighlight, secondHighlight] = content.highlights.items;
  const [firstExperience, secondExperience] = content.experience.items;
  const [firstDish, secondDish] = content.dishes.items;
  const conceptSentence = `${content.business.name} is built around ${content.business.concept.toLowerCase()}, pairing ${content.business.cuisine.toLowerCase()} cooking with ${content.business.vibe.toLowerCase()} energy.`;
  const serviceSentence =
    "Each course, table touchpoint, and reservation exchange is designed to feel composed, high-touch, and confidently paced from arrival through the last pour.";

  const storyParagraphs = [
    buildDenseCopy(
      content.story.paragraphs[0] ?? content.story.description,
      28,
      [
        conceptSentence,
        "The room is designed for guests who want a dramatic first impression, polished service, and a menu that unfolds with real momentum across the evening."
      ],
      "The restaurant opens with a composed sense of arrival, then builds into a richer dining rhythm that feels deliberate rather than rushed."
    ),
    buildDenseCopy(
      content.story.paragraphs[1],
      28,
      [
        `${firstHighlight.title} and ${secondHighlight?.title ?? "the signature menu"} anchor the experience with confident plating, layered flavor, and enough detail to reward a slower, more attentive meal.`,
        `${firstExperience.title} and ${secondExperience?.title ?? "the dining ritual"} give the evening structure without making the room feel formal for the sake of formality.`
      ],
      "Signature dishes and service rituals work together so the evening feels cinematic, grounded, and memorable from the first course onward."
    ),
    buildDenseCopy(
      content.story.paragraphs[2],
      28,
      [
        serviceSentence,
        `Reservations, special requests, and private dining inquiries are handled with the same level of care so guests feel looked after before they even step through the door.`
      ],
      "The overall goal is simple: guests should leave feeling they experienced a complete night out, not just a series of plates."
    )
  ];

  return {
    ...content,
    hero: {
      ...content.hero,
      subheadline: buildDenseCopy(
        content.hero.subheadline,
        18,
        [
          `${content.business.name} delivers ${content.business.cuisine.toLowerCase()} cooking in a ${content.business.vibe.toLowerCase()} setting built for longer dinners, sharper service, and stronger reservation intent.`,
          `${firstDish.title} and ${secondDish?.title ?? "the signature menu"} set the tone for a room that feels premium from the first look through the final course.`
        ],
        `${content.business.name} is a destination for guests who want a premium dining night with substance, atmosphere, and a reservation flow that converts cleanly.`
      )
    },
    story: {
      ...content.story,
      description: buildDenseCopy(
        content.story.description,
        18,
        [storyParagraphs[0], conceptSentence],
        `${content.business.name} is a high-intent dining experience shaped around atmosphere, pacing, and a clear point of view on service.`
      ),
      paragraphs: storyParagraphs,
      principles: padArray(content.story.principles, 4, clonePrinciple)
        .slice(0, 4)
        .map((item, index) => ({
          ...item,
          description: buildDenseCopy(
            item.description,
            14,
            [
              `${item.title} keeps the dining room aligned with the restaurant's ${content.business.vibe.toLowerCase()} tone while still leaving space for warmth, confidence, and real hospitality.`,
              `${content.business.name} uses this principle to make every table feel intentional instead of generic.`
            ],
            `This principle helps the restaurant stay coherent, premium, and guest-focused across service, menu pacing, and the overall room experience.`
          )
        }))
    },
    highlights: {
      ...content.highlights,
      description: buildDenseCopy(
        content.highlights.description,
        16,
        [
          `${content.business.name} uses these signature highlights to show range, restraint, and the kind of visual polish guests remember after service ends.`,
          `${firstHighlight.title} leads the lineup with a stronger point of view on plating, flavor, and finish.`
        ],
        "These highlights are meant to feel like the strongest editorial moments on the menu, not filler between sections."
      ),
      items: padArray(content.highlights.items, 6, cloneContentItem)
        .slice(0, 6)
        .map((item, index) => ({
          ...item,
          subtitle: item.subtitle ?? item.note ?? `Signature moment ${index + 1}`,
          description: buildDenseCopy(
            item.description,
            14,
            [
              `${item.title} brings together ${item.subtitle?.toLowerCase() ?? "a focused composition"} with the kind of detail that reads well both on the plate and in a premium restaurant story.`,
              item.note
            ],
            `This course gives guests a clear sense of the restaurant's pace, confidence, and attention to finish.`
          )
        }))
    },
    experience: {
      ...content.experience,
      description: buildDenseCopy(
        content.experience.description,
        18,
        [
          serviceSentence,
          `${content.business.name} treats the full evening as a sequence of considered moments rather than a simple meal transaction.`
        ],
        "The experience is designed to feel choreographed, premium, and calm without losing warmth or ease."
      ),
      items: padArray(content.experience.items, 4, cloneExperienceItem)
        .slice(0, 4)
        .map((item, index) => ({
          ...item,
          description: buildDenseCopy(
            item.description,
            16,
            [
              `${item.title} gives guests a more polished sense of pace, attention, and service detail from the moment they sit down.`,
              item.note
            ],
            `This moment helps the evening feel measured, premium, and well-paced rather than improvised.`
          ),
          note: ensureSentence(
            item.note ??
              `Service cue ${index + 1} is handled with the same composed attention found throughout the rest of the room.`
          )
        }))
    },
    dishes: {
      ...content.dishes,
      note: buildDenseCopy(
        content.dishes.note,
        14,
        [
          `${content.business.name} needs enough signature dishes to make the page feel fully considered, not under-filled or repetitive.`,
          `${firstDish.title} and ${secondDish?.title ?? "the wider menu"} establish that sense of depth immediately.`
        ],
        "The dish selection should feel complete enough to support a premium first-pass website, with clear anchors for guests who are deciding whether to book."
      ),
      items: padArray(content.dishes.items, 4, cloneContentItem)
        .slice(0, 4)
        .map((item) => ({
          ...item,
          description: buildDenseCopy(
            item.description,
            15,
            [
              `${item.title} combines ${item.subtitle?.toLowerCase() ?? "restaurant craft"} with a finish that feels worthy of a signature placement on the menu.`,
              item.technique,
              item.note
            ],
            `This dish strengthens the restaurant's signature lineup with a fuller sense of texture, pacing, and finish.`
          )
        }))
    },
    reservation: {
      ...content.reservation,
      description: buildDenseCopy(
        content.reservation.description,
        18,
        [
          `Use this reservation block to convert guests who already like the look of ${content.business.name} and need one more reason to commit to a night out.`,
          `It should support standard bookings, celebratory tables, and higher-intent visits without sounding generic or transactional.`
        ],
        "Reserve with enough confidence that the final section feels like a polished invitation, not a placeholder button."
      )
    }
  };
};

const finalizeTemplateContent = (
  content: RestaurantTemplateContent,
  context: RestaurantGenerationContext
) => {
  const normalizedContent = sanitizePromptEchoCopy(content, context);
  const denseContent = ensureTemplateDensity(normalizedContent, context);
  if (context.template === "evasion") {
    return ensureEvasionDensity(denseContent);
  }
  return denseContent;
};

const parseJsonObject = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const summarizeIssues = (issues: Array<{ path: PropertyKey[]; message: string }>) =>
  issues
    .slice(0, 8)
    .map((issue) => `${issue.path.map((part) => String(part)).join(".") || "root"}: ${issue.message}`)
    .join("\n");

const runJsonPrompt = async (
  openai: OpenAI,
  messages: ChatCompletionMessageParam[],
  modelOverride?: string
) => {
  const requestedModel = modelOverride ?? MODEL;
  try {
    const completion = await openai.chat.completions.create({
      model: requestedModel,
      temperature: requestedModel === THINK_MODEL ? 0.2 : 0.45,
      response_format: { type: "json_object" },
      messages
    });
    return completion.choices[0]?.message?.content ?? "";
  } catch (error) {
    if (requestedModel === MODEL) {
      throw error;
    }
    const fallback = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages
    });
    return fallback.choices[0]?.message?.content ?? "";
  }
};

const parseRestaurantContent = (
  raw: string,
  context: RestaurantGenerationContext
) => {
  const parsed = RestaurantTemplateContentSchema.safeParse(parseJsonObject(raw));
  if (!parsed.success) {
    return {
      ok: false as const,
      issues: summarizeIssues(parsed.error.issues)
    };
  }

  return {
    ok: true as const,
    content: hydrateContent(parsed.data, context)
  };
};

const repairRestaurantContent = async (
  openai: OpenAI,
  raw: string,
  issues: string
) =>
  runJsonPrompt(openai, [
    {
      role: "system",
      content: [
        "Repair restaurant website content JSON for a fixed template system.",
        baseJsonInstruction,
        "Return the full corrected content object.",
        "Required top-level keys: business, hero, story, highlights, experience, dishes, faq, reservation, contact, footer, imageBriefs. menu is optional.",
        "Use the exact field names from the provided JSON shape."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        "Fix the JSON so it satisfies the required schema.",
        "Validation issues:",
        issues,
        "Required JSON shape:",
        CONTENT_SHAPE_GUIDE,
        "Previous JSON:",
        raw
      ].join("\n")
    }
  ]);

export const enhanceRestaurantPrompt = async (
  openai: OpenAI,
  prompt: string,
  businessName?: string | null,
  industry?: string | null,
  themeStyle?: ThemeStyleId | null,
  primaryColor?: string | null,
  secondaryColor?: string | null
) => {
  const theme = getThemeStyleOption(themeStyle);
  const palette = describePalette(primaryColor, secondaryColor);
  const raw = await runJsonPrompt(openai, [
    {
      role: "system",
      content:
        "You improve restaurant website prompts for a template-based builder. Preserve intent, but make the prompt materially more useful. Return JSON with one key: enhancedPrompt. The enhanced prompt must cover restaurant type, cuisine, guest experience, design direction, reservation conversion intent, section structure, proof points, image direction, and desired calls to action. Keep it compact enough to paste into a builder, but rich enough to guide template selection and first-pass site generation."
    },
    {
      role: "user",
      content: [
        baseJsonInstruction,
        `Business: ${businessName ?? "Unknown business"}`,
        `Industry: ${industry ?? "Restaurant"}`,
        `Theme style: ${theme?.label ?? "Not specified"}`,
        theme ? `Theme direction: ${theme.promptHint}` : null,
        palette ? `Color direction: ${palette}` : null,
        "Rewrite the prompt as one high-signal builder instruction.",
        "Include: business clarity, cuisine and service format, intended guest experience, theme/style direction, conversion goal around reservations, content sections to fill, and image direction that avoids generic or absurd visuals.",
        "Mention the need for a strong hero, restaurant story, highlights or signature dishes, trust/experience cues, reservation section, contact details, and enough imagery to fill the chosen template.",
        `Prompt: ${prompt}`
      ]
        .filter(Boolean)
        .join("\n")
    }
  ]);

  const parsed = parseJsonObject(raw) as { enhancedPrompt?: unknown } | null;
  const enhancedPrompt =
    parsed && typeof parsed.enhancedPrompt === "string" ? parsed.enhancedPrompt.trim() : "";

  if (!enhancedPrompt) {
    throw new Error("OpenAI did not return an enhanced prompt.");
  }

  return enhancedPrompt;
};

export const generateRestaurantTemplateContent = async (
  openai: OpenAI,
  context: RestaurantGenerationContext
) => {
  const theme = getThemeStyleOption(context.themeStyle);
  const palette = describePalette(context.primaryColor, context.secondaryColor);
  const raw = await runJsonPrompt(openai, [
    {
      role: "system",
      content: [
        "You write restaurant website content for a fixed template system.",
        baseJsonInstruction,
        "Return the full content object for hero, story, highlights, experience, dishes, FAQ, reservation, contact, footer, menu, and imageBriefs.",
        "Use the exact field names from the provided JSON shape.",
        "Use restaurant-appropriate contact and reservation placeholders when data is missing.",
        "Make menu categories useful for casual restaurant websites even if some templates ignore them.",
        "Translate builder instructions into natural guest-facing website copy.",
        "Never repeat builder meta phrases like 'generate a website', 'existing business information', 'core offer', 'contact path', 'customer trust', or 'mobile-friendly experience'.",
        SLOT_GUARDRAILS
      ].join(" ")
    },
    {
      role: "user",
      content: [
        `Template: ${context.template}`,
        `Template direction: ${TEMPLATE_DIRECTIONS[context.template]}`,
        `Completeness rule: ${TEMPLATE_COMPLETENESS_RULES[context.template]}`,
        `Theme style: ${theme?.label ?? "Not specified"}`,
        theme ? `Theme direction: ${theme.contentDirection}` : null,
        palette ? `Color direction: ${palette}` : null,
        `Business name: ${context.businessName}`,
        `Industry: ${context.industry}`,
        `Prompt: ${context.prompt}`,
        `Email: ${context.contact?.email ?? "not provided"}`,
        `Phone: ${context.contact?.phone ?? "not provided"}`,
        `Address: ${context.contact?.address ?? "not provided"}`,
        `Opening hours: ${context.openingHours ?? "not provided"}`,
        `Socials: ${JSON.stringify(context.socials ?? {})}`,
        "Required JSON shape:",
        CONTENT_SHAPE_GUIDE
      ]
        .filter(Boolean)
        .join("\n")
    }
  ]);

  const parsed = parseRestaurantContent(raw, context);
  if (parsed.ok) {
    return finalizeTemplateContent(parsed.content, context);
  }

  const repairedRaw = await repairRestaurantContent(openai, raw, parsed.issues);
  const repaired = parseRestaurantContent(repairedRaw, context);
  if (!repaired.ok) {
    throw new Error("OpenAI returned invalid restaurant template content.");
  }

  return finalizeTemplateContent(repaired.content, context);
};

export const refineRestaurantTemplateContent = async (
  openai: OpenAI,
  context: RestaurantGenerationContext & {
    currentContent: RestaurantTemplateContent;
    instruction: string;
  },
  options?: {
    model?: string;
  }
) => {
  const theme = getThemeStyleOption(context.themeStyle);
  const palette = describePalette(context.primaryColor, context.secondaryColor);
  const raw = await runJsonPrompt(openai, [
    {
      role: "system",
      content: [
        "You revise restaurant website content for a fixed template.",
        baseJsonInstruction,
        "Return the full updated content object.",
        "Use the exact field names from the provided JSON shape.",
        "Preserve structure and only change what the instruction requires.",
        "When the request says a section is broken, weak, wrong, or needs fixing, replace that section decisively instead of making cosmetic wording changes.",
        "You must make a material change. Do not return the previous content unchanged.",
        "If the request targets FAQ, rewrite the FAQ heading and all FAQ items with practical guest-facing questions and clear answers.",
        "Translate builder instructions into natural guest-facing website copy.",
        "Do not echo builder meta phrases like 'generate a website', 'existing business information', 'core offer', 'contact path', or 'customer trust'.",
        SLOT_GUARDRAILS
      ].join(" ")
    },
    {
      role: "user",
      content: [
        `Template: ${context.template}`,
        `Template direction: ${TEMPLATE_DIRECTIONS[context.template]}`,
        `Completeness rule: ${TEMPLATE_COMPLETENESS_RULES[context.template]}`,
        `Theme style: ${theme?.label ?? "Not specified"}`,
        theme ? `Theme direction: ${theme.contentDirection}` : null,
        palette ? `Color direction: ${palette}` : null,
        `Business name: ${context.businessName}`,
        `Prompt: ${context.prompt}`,
        `Edit instruction: ${context.instruction}`,
        "Required JSON shape:",
        CONTENT_SHAPE_GUIDE,
        `Current content JSON: ${JSON.stringify(context.currentContent)}`
      ]
        .filter(Boolean)
        .join("\n")
    }
  ], options?.model);

  const parsed = parseRestaurantContent(raw, context);
  if (parsed.ok) {
    return finalizeTemplateContent(parsed.content, context);
  }

  const repairedRaw = await repairRestaurantContent(openai, raw, parsed.issues);
  const repaired = parseRestaurantContent(repairedRaw, context);
  if (!repaired.ok) {
    throw new Error("OpenAI returned invalid refined restaurant content.");
  }

  return finalizeTemplateContent(repaired.content, context);
};
