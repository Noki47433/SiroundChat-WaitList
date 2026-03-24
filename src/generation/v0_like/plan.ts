import { runStrictJsonWithRetry } from "@/lib/builder/generation/llm";
import {
  primaryGoalHref,
  primaryGoalLabel,
  resolveLocaleFromLanguage,
  type QualityMode
} from "@/lib/builder/generation-config";
import {
  type WebsitePlan,
  type WebsitePlanSection,
  WebsitePlanSchema,
  validateWebsitePlan
} from "@/src/generation/v0_like/schema";
import {
  allowedSectionsByVertical,
  defaultOrderByVertical,
  promptExplicitlyRequestsPricing,
  promptLikelyContainsRealMetrics
} from "@/src/generation/v0_like/registry";
import { TOKEN_CLAMPS } from "@/src/generation/v0_like/tokens";
import {
  THEME_ACCENTS,
  type IntakeBrief,
  type SectionType,
  type ThemeAccent,
  type ThemeFont
} from "@/src/generation/v0_like/types";

export const PROMPT_STAGE_1_PLAN = [
  "Stage 1 Plan: return ONLY JSON matching WebsitePlan schema.",
  "No prose, no markdown, no comments.",
  "Use section types from the explicit allowlist only.",
  "Use vertical as the primary driver for sections, nav, CTA, media, and copy.",
  "Use the structured business brief as the source of truth for audience, offer, services, proof, and CTA wording.",
  "Use recommended order by vertical.",
  "Respect token clamps and copy limits.",
  "Do not add unverifiable claims or fake customer names/logos/metrics.",
  "User-facing website copy must sound launch-ready, specific, and customer-facing.",
  "Forbidden words/phrases in all copy fields: schema, deterministic, pipeline, retry, validation, tests, coverage, onboarding setup.",
  "If vertical is restaurant: nav must be Home/Menu/Reservations/About/Contact, CTA must be reservation/menu oriented, pricing is forbidden unless explicitly requested, and testimonials must be diner/guest language.",
  "If vertical is clinic: copy must be about dental/clinic care, hero and supporting sections must include non-empty photo sources, nav should be services/about/testimonials/contact, and CTA should be appointment oriented.",
  "If vertical is barbershop: copy must mention cuts, fades, beard work, appointments, and repeat local clients. Avoid generic service-business wording."
].join("\n");

const CTA_LABEL_BY_GOAL: Record<WebsitePlan["meta"]["primaryGoal"], string> = {
  sign_up: "Start Free Trial",
  request_demo: "Request Demo",
  book_call: "Book a Call",
  reservations: "Book a Table",
  buy_now: "Buy Now",
  email_capture: "Join Newsletter",
  visit_location: "Get Directions",
  download: "Download Guide",
  other: "Contact"
};

const CTA_HREF_BY_GOAL: Record<WebsitePlan["meta"]["primaryGoal"], string> = {
  sign_up: "/signup",
  request_demo: "/demo",
  book_call: "/contact",
  reservations: "/#reservations",
  buy_now: "/shop",
  email_capture: "/subscribe",
  visit_location: "/#location",
  download: "/download",
  other: "/contact"
};

const NON_DECEPTIVE_METRICS = [
  { value: "24/7", label: "Guest support" },
  { value: "Fresh", label: "Seasonal ingredients" },
  { value: "Local", label: "Neighborhood favorite" }
] as const;

const RESTAURANT_PLACEHOLDERS = {
  hero: "/images/placeholders/restaurant-hero.jpg",
  gallery1: "/images/placeholders/restaurant-1.jpg",
  gallery2: "/images/placeholders/restaurant-2.jpg",
  gallery3: "/images/placeholders/restaurant-3.jpg"
} as const;

const CLINIC_PLACEHOLDERS = {
  hero: "https://images.pexels.com/photos/6627565/pexels-photo-6627565.jpeg",
  team: "https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg",
  testimonials: "https://images.pexels.com/photos/3881449/pexels-photo-3881449.jpeg",
  cta: "https://images.pexels.com/photos/4269363/pexels-photo-4269363.jpeg"
} as const;

const GENERIC_LOGO_PLACEHOLDERS = {
  one: "/images/placeholders/logo-1.svg",
  two: "/images/placeholders/logo-2.svg",
  three: "/images/placeholders/logo-3.svg"
} as const;

const HERO_MEDIA_BY_VERTICAL = {
  restaurant: RESTAURANT_PLACEHOLDERS.hero,
  clinic: CLINIC_PLACEHOLDERS.hero,
  barbershop: "https://images.pexels.com/photos/1813272/pexels-photo-1813272.jpeg",
  saas: "https://images.pexels.com/photos/3183183/pexels-photo-3183183.jpeg",
  ecommerce: "https://images.pexels.com/photos/5632402/pexels-photo-5632402.jpeg",
  portfolio: "https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg",
  event: "https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg",
  blog: "https://images.pexels.com/photos/261662/pexels-photo-261662.jpeg",
  local_business: "https://images.pexels.com/photos/380769/pexels-photo-380769.jpeg",
  other: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg"
} as const;

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const pickBySeed = <T,>(seed: number, values: readonly T[]) => {
  if (!values.length) {
    throw new Error("Cannot pick from empty array");
  }
  return values[seed % values.length];
};

const sentenceCase = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const prettifyKey = (value: string) =>
  value
    .replaceAll("_", " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const clamp = (value: string, max: number) => {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trim();
};

const minLen = (value: string, min: number, filler: string) => {
  if (value.length >= min) return value;
  return clamp(`${value} ${filler}`.trim(), Math.max(min, value.length + filler.length + 1));
};

const toSectionId = (type: SectionType, index: number) =>
  `sec-${type.replaceAll("_", "-")}-${String(index + 1).padStart(2, "0")}`;

const includePricing = (intake: IntakeBrief, rawPrompt: string) => {
  if (intake.vertical === "restaurant") {
    return intake.allowPricingForRestaurant;
  }
  return intake.siteType === "saas" || promptExplicitlyRequestsPricing(rawPrompt);
};

const includeMetrics = (rawPrompt: string) => {
  return promptLikelyContainsRealMetrics(rawPrompt);
};

const parsePromptMetrics = (rawPrompt: string) => {
  const matches = rawPrompt.match(/\b\d+\s?(%|x|users|customers|reviews|years|days|hours|projects)\b/gi) ?? [];
  if (!matches.length) {
    return NON_DECEPTIVE_METRICS;
  }

  const values = matches.slice(0, 3).map((value, index) => ({
    value: clamp(value, 12),
    label: NON_DECEPTIVE_METRICS[index]?.label ?? `Key metric ${index + 1}`
  }));

  while (values.length < 3) {
    values.push({ ...NON_DECEPTIVE_METRICS[values.length] });
  }

  return values;
};

const normalizeOrder = (intake: IntakeBrief, rawPrompt: string): SectionType[] => {
  const allowed = new Set(allowedSectionsByVertical[intake.vertical]);
  const base = [...defaultOrderByVertical[intake.vertical]].filter((section) => allowed.has(section));
  const pricingAllowed = includePricing(intake, rawPrompt);

  if (intake.vertical === "restaurant" && pricingAllowed && !base.includes("pricing")) {
    const ctaBannerIndex = base.indexOf("cta_banner");
    if (ctaBannerIndex >= 0) {
      base.splice(ctaBannerIndex, 0, "pricing");
    } else {
      base.splice(Math.max(base.length - 1, 0), 0, "pricing");
    }
  }

  if (!pricingAllowed) {
    const pricingIndex = base.indexOf("pricing");
    if (pricingIndex >= 0) {
      base.splice(pricingIndex, 1);
    }
  }

  if (!includeMetrics(rawPrompt)) {
    const metricsIndex = base.indexOf("metrics");
    if (metricsIndex >= 0) {
      base.splice(metricsIndex, 1);
    }
  }

  intake.mustHaveSections.forEach((section) => {
    if (!allowed.has(section)) return;
    if (base.includes(section)) return;
    const footerIndex = base.indexOf("footer");
    if (footerIndex === -1) {
      base.push(section);
      return;
    }
    base.splice(footerIndex, 0, section);
  });

  intake.mustAvoid.forEach((rule) => {
    const lowered = rule.toLowerCase();
    [...allowed].forEach((section) => {
      if (lowered.includes(section.replaceAll("_", " ")) || lowered === section) {
        const index = base.indexOf(section);
        if (index >= 0) base.splice(index, 1);
      }
    });
  });

  if (!base.includes("header")) base.unshift("header");
  if (!base.includes("hero")) base.splice(1, 0, "hero");
  if (!base.includes("footer")) base.push("footer");

  const unique = Array.from(new Set(base)).filter((type) => allowed.has(type));

  const headerIndex = unique.indexOf("header");
  if (headerIndex > 0) {
    unique.splice(headerIndex, 1);
    unique.unshift("header");
  }

  const heroIndex = unique.indexOf("hero");
  if (heroIndex !== 1) {
    if (heroIndex >= 0) unique.splice(heroIndex, 1);
    unique.splice(1, 0, "hero");
  }

  const footerIndex = unique.indexOf("footer");
  if (footerIndex !== unique.length - 1) {
    if (footerIndex >= 0) unique.splice(footerIndex, 1);
    unique.push("footer");
  }

  if (intake.vertical === "restaurant") {
    const required = ["header", "hero", "features", "feature_spotlight", "contact", "testimonials", "cta_banner", "footer"] as SectionType[];
    const filtered = required.filter((type) => unique.includes(type));
    return filtered;
  }

  return unique;
};

const sectionMediaLocal = (
  role: WebsitePlanSection["media"][number]["role"],
  src: string,
  alt: string,
  aspectRatio: WebsitePlanSection["media"][number]["aspectRatio"] = "16:9"
) => ({
  role,
  source: "user" as const,
  aspectRatio,
  src,
  alt: clamp(alt, 120)
});

const buildHeaderLinks = (intake: IntakeBrief) => {
  if (intake.vertical === "restaurant") {
    return [
      { label: "Home", href: "/#home" },
      { label: "Menu", href: "/#menu" },
      { label: "Reservations", href: "/#reservations" },
      { label: "About", href: "/#about" },
      { label: "Contact", href: "/#contact" }
    ];
  }

  if (intake.vertical === "clinic") {
    return [
      { label: "Services", href: "/#services" },
      { label: "About", href: "/#about" },
      { label: "Testimonials", href: "/#testimonials" },
      { label: "Contact", href: "/#contact" }
    ];
  }

  if (intake.vertical === "barbershop") {
    return [
      { label: "Services", href: "/#services" },
      { label: "Experience", href: "/#about" },
      { label: "Reviews", href: "/#testimonials" },
      { label: "FAQ", href: "/#faq" },
      { label: "Contact", href: "/#contact" }
    ];
  }

  if (intake.vertical === "ecommerce") {
    return [
      { label: "Shop", href: "/#shop" },
      { label: "Reviews", href: "/#testimonials" },
      { label: "FAQ", href: "/#faq" },
      { label: "Contact", href: "/#contact" }
    ];
  }

  if (intake.vertical === "portfolio") {
    return [
      { label: "Work", href: "/#work" },
      { label: "About", href: "/#about" },
      { label: "Testimonials", href: "/#testimonials" },
      { label: "Contact", href: "/#contact" }
    ];
  }

  if (intake.vertical === "event") {
    return [
      { label: "Agenda", href: "/#agenda" },
      { label: "Speakers", href: "/#speakers" },
      { label: "Tickets", href: "/#tickets" },
      { label: "FAQ", href: "/#faq" }
    ];
  }

  if (intake.vertical === "blog") {
    return [
      { label: "Latest", href: "/#latest" },
      { label: "Topics", href: "/#topics" },
      { label: "About", href: "/#about" },
      { label: "Contact", href: "/#contact" }
    ];
  }

  if (intake.vertical === "local_business") {
    return [
      { label: "Services", href: "/#services" },
      { label: "About", href: "/#about" },
      { label: "Testimonials", href: "/#testimonials" },
      { label: "Contact", href: "/#contact" }
    ];
  }

  return [
    { label: "Home", href: "/#home" },
    { label: "About", href: "/#about" },
    { label: "Contact", href: "/#contact" }
  ];
};

const firstServiceList = (intake: IntakeBrief) =>
  intake.brief.topServices.length > 0 ? intake.brief.topServices : ["Service quality", "Fast response", "Clear next steps"];

const buildSection = (
  sectionType: SectionType,
  intake: IntakeBrief,
  orderIndex: number,
  rawPrompt: string,
  seed: number,
  planPrimaryLabel: string,
  planPrimaryHref: string,
  planSecondaryLabel: string,
  planSecondaryHref: string
): WebsitePlanSection => {
  const id = toSectionId(sectionType, orderIndex);

  switch (sectionType) {
    case "header":
      return {
        id,
        type: "header",
        variant: "simple",
        props: { sticky: true },
        copy: {
          links: buildHeaderLinks(intake)
        },
        media: intake.logoUrl
          ? [sectionMediaLocal("logo", intake.logoUrl, `${intake.brandName} logo`, "1:1")]
          : [],
        ctas: []
      };
    case "hero": {
      const variant = pickBySeed(seed, ["split", "centered"] as const);
      const services = firstServiceList(intake);
      const proofPoints = intake.brief.proofPoints.filter(Boolean);
      const headlineBase =
        intake.vertical === "restaurant"
          ? `${intake.brandName} for ${services[0]?.toLowerCase() ?? "seasonal dining"} in your neighborhood`
          : intake.vertical === "clinic"
            ? `${intake.brandName} keeps your smile healthy`
            : intake.vertical === "barbershop"
              ? `${intake.brandName} sharp cuts for busy local clients`
            : intake.vertical === "saas"
              ? `${intake.brandName} helps teams move faster`
              : intake.vertical === "ecommerce"
                ? `${intake.brandName} products for ${intake.audience}`
                : intake.vertical === "portfolio"
                  ? `${intake.brandName} creative work for ${intake.audience}`
                  : intake.vertical === "event"
                    ? `${intake.brandName} live event experience`
                    : intake.vertical === "blog"
                      ? `${intake.brandName} insights for ${intake.audience}`
                      : `${intake.brandName} for ${intake.audience}`;
      const headline = minLen(clamp(sentenceCase(headlineBase), 60), 8, "today");

      const subheadlineBase =
        intake.vertical === "restaurant"
          ? `${intake.brandName} serves ${services[0]?.toLowerCase() ?? "seasonal dishes"}, ${services[1]?.toLowerCase() ?? "private dining"}, and ${services[2]?.toLowerCase() ?? "chef specials"} for ${intake.audience.toLowerCase()}. ${proofPoints[0] ?? "Fast confirmation"} and warm ambience make booking dinner simple.`
          : intake.vertical === "clinic"
            ? `${intake.brandName} provides gentle dental care for ${intake.audience.toLowerCase()}. Book your visit and get clear treatment guidance from a trusted team.`
            : intake.vertical === "barbershop"
              ? `${intake.brandName} helps ${intake.audience.toLowerCase()} book ${intake.offer.toLowerCase()} with fast scheduling, reliable appointment flow, and a sharper first impression every visit.`
            : intake.vertical === "saas"
              ? `${intake.brandName} helps ${intake.audience} with ${intake.offer}. Explore product capabilities and request a guided walkthrough.`
              : intake.vertical === "ecommerce"
                ? `${intake.brandName} offers curated ${intake.offer.toLowerCase()} with fast checkout and trusted support.`
                : intake.vertical === "portfolio"
                  ? `${intake.brandName} showcases selected projects, creative process, and outcomes for ${intake.audience.toLowerCase()}.`
                  : intake.vertical === "event"
                    ? `${intake.brandName} brings together speakers, sessions, and practical takeaways in one event experience.`
                    : intake.vertical === "blog"
                      ? `${intake.brandName} publishes practical articles and updates tailored for ${intake.audience.toLowerCase()}.`
                      : `${intake.brandName} helps ${intake.audience} with ${intake.offer}. Clear outcomes and a direct path to ${planPrimaryLabel.toLowerCase()}.`;
      const subheadline = minLen(clamp(subheadlineBase, 160), 20, "Built for real customers.");

      const heroMedia =
        intake.vertical === "restaurant"
          ? [
              sectionMediaLocal(
                "hero",
                RESTAURANT_PLACEHOLDERS.hero,
                `${intake.brandName} hero food and ambience photo`,
                "16:9"
              )
            ]
          : intake.vertical === "clinic"
            ? [
                sectionMediaLocal(
                  "hero",
                  CLINIC_PLACEHOLDERS.hero,
                  `${intake.brandName} clinic hero dental care photo`,
                  "16:9"
                )
              ]
            : intake.vertical === "barbershop"
              ? [
                  sectionMediaLocal(
                    "hero",
                    HERO_MEDIA_BY_VERTICAL.barbershop,
                    `${intake.brandName} barber chair and grooming photo`,
                    "16:9"
                  )
                ]
            : [
                sectionMediaLocal(
                  "hero",
                  HERO_MEDIA_BY_VERTICAL[intake.vertical],
                  `${intake.brandName} ${prettifyKey(intake.vertical).toLowerCase()} hero photo`,
                  "16:9"
                )
              ];

      return {
        id,
        type: "hero",
        variant,
        props: { hasMockup: variant === "split" },
        copy: {
          headline,
          subheadline,
          badge: clamp(
            intake.vertical === "restaurant"
              ? "Restaurant"
              : intake.vertical === "clinic"
                ? "Dental Clinic"
                : intake.vertical === "barbershop"
                  ? "Barbershop"
                : `${prettifyKey(intake.vertical)} website`,
            24
          ),
          primaryCtaLabel: clamp(planPrimaryLabel, 20),
          secondaryCtaLabel: clamp(planSecondaryLabel, 20)
        },
        media: heroMedia,
        ctas: [
          { intent: "primary", label: clamp(planPrimaryLabel, 20), href: planPrimaryHref, style: "primary" },
          { intent: "secondary", label: clamp(planSecondaryLabel, 20), href: planSecondaryHref, style: "secondary" }
        ]
      };
    }
    case "logos":
      return {
        id,
        type: "logos",
        variant: "grid",
        props: { columns: pickBySeed(seed, [3, 4, 5] as const) },
        copy: {
          label: clamp("Trusted by valued partners", 40)
        },
        media: [
          sectionMediaLocal("logo", GENERIC_LOGO_PLACEHOLDERS.one, "Partner logo 1", "1:1"),
          sectionMediaLocal("logo", GENERIC_LOGO_PLACEHOLDERS.two, "Partner logo 2", "1:1"),
          sectionMediaLocal("logo", GENERIC_LOGO_PLACEHOLDERS.three, "Partner logo 3", "1:1")
        ],
        ctas: []
      };
    case "features":
      if (intake.vertical === "restaurant") {
        const services = firstServiceList(intake);
        const proofPoints = intake.brief.proofPoints.filter(Boolean);
        return {
          id,
          type: "features",
          variant: "grid3",
          props: { columns: 3 },
          copy: {
            title: clamp("Menu Highlights", 40),
            items: [
              {
                title: clamp(sentenceCase(services[0] ?? "Signature dishes"), 32),
                description: minLen(
                  clamp(
                    proofPoints[0]
                      ? `${proofPoints[0]}. Guests can book with confidence and know what to expect before arrival.`
                      : "Explore chef specials made with seasonal produce and house-made sauces.",
                    120
                  ),
                  20,
                  "Guests can book with confidence."
                )
              },
              {
                title: clamp(sentenceCase(services[1] ?? "Private dining"), 32),
                description: minLen(
                  clamp(
                    proofPoints[1]
                      ? `${proofPoints[1]}. It helps diners plan dinners, celebrations, and group bookings more easily.`
                      : "Our kitchen prepares each plate with local ingredients selected daily.",
                    120
                  ),
                  20,
                  "Plan dinner and group bookings more easily."
                )
              },
              {
                title: clamp(sentenceCase(services[2] ?? "Chef specials"), 32),
                description: minLen(
                  clamp(
                    proofPoints[2]
                      ? `${proofPoints[2]}. Return visits feel smoother because the menu and booking flow stay clear.`
                      : "Enjoy a comfortable dining room ideal for dinner dates and family meals.",
                    120
                  ),
                  20,
                  "Return visits feel smoother and more predictable."
                )
              }
            ]
          },
          media: [],
          ctas: []
        };
      }

      if (intake.vertical === "barbershop") {
        const services = firstServiceList(intake);
        return {
          id,
          type: "features",
          variant: "grid3",
          props: { columns: 3 },
          copy: {
            title: clamp("Signature Grooming Services", 40),
            items: [
              {
                title: clamp(sentenceCase(services[0] ?? "Precision cuts"), 32),
                description: clamp(
                  "Built for clients who need a clean finish, predictable timing, and a look that holds between visits.",
                  120
                )
              },
              {
                title: clamp(sentenceCase(services[1] ?? "Beard shaping"), 32),
                description: clamp(
                  "Define beard lines, shape, and balance so every appointment leaves a sharper first impression.",
                  120
                )
              },
              {
                title: clamp(sentenceCase(services[2] ?? "Appointment-ready styling"), 32),
                description: clamp(
                  "Fast, repeatable service flow for local professionals who want consistency without wasting time.",
                  120
                )
              }
            ]
          },
          media: [],
          ctas: []
        };
      }

      return {
        id,
        type: "features",
        variant: intake.density === "dense" ? "grid4" : "grid3",
        props: { columns: intake.density === "dense" ? 4 : 3 },
        copy: {
          title: clamp(
            intake.vertical === "clinic"
              ? "Everything your smile needs"
              : intake.vertical === "ecommerce"
                ? "Featured Collections"
                : intake.vertical === "portfolio"
                  ? "Featured Projects"
                  : intake.vertical === "event"
                    ? "What to Expect"
                    : intake.vertical === "blog"
                      ? "Why Readers Subscribe"
                      : intake.vertical === "saas"
                        ? "Core Product Benefits"
                        : "Services Overview",
            40
          ),
          items: [
            {
              title: clamp(
                intake.vertical === "clinic"
                  ? "Preventive Care"
                  : intake.vertical === "ecommerce"
                    ? "Best Sellers"
                    : intake.vertical === "portfolio"
                      ? "Brand Identity"
                      : intake.vertical === "event"
                        ? "Expert Speakers"
                        : intake.vertical === "blog"
                          ? "Actionable Guides"
                          : intake.vertical === "saas"
                            ? "Team Productivity"
                            : `Trusted ${prettifyKey(intake.offer).slice(0, 24)}`,
                32
              ),
              description: clamp(
                intake.vertical === "clinic"
                  ? "Regular checkups and cleanings to keep teeth healthy and catch small issues early."
                  : intake.vertical === "ecommerce"
                    ? "Shop curated products with clear details, transparent pricing, and fast delivery options."
                    : intake.vertical === "portfolio"
                      ? "See selected branding and design work with process notes and measurable outcomes."
                      : intake.vertical === "event"
                        ? "Learn from practical sessions led by operators and specialists in the field."
                        : intake.vertical === "blog"
                          ? "Read clear, practical posts that explain complex topics without filler."
                          : intake.vertical === "saas"
                            ? "Automate repetitive work and keep teams aligned across projects and workflows."
                            : `${intake.brandName} delivers ${intake.offer.toLowerCase()} with dependable service quality.`,
                120
              )
            },
            {
              title: clamp(
                intake.vertical === "clinic"
                  ? "Cosmetic Dentistry"
                  : intake.vertical === "ecommerce"
                    ? "Secure Checkout"
                    : intake.vertical === "portfolio"
                      ? "Web Experiences"
                      : intake.vertical === "event"
                        ? "Networking"
                        : intake.vertical === "blog"
                          ? "Regular Publishing"
                          : intake.vertical === "saas"
                            ? "Workflow Clarity"
                            : "Local Expertise",
                32
              ),
              description: clamp(
                intake.vertical === "clinic"
                  ? "Whitening, veneers, and smile makeovers designed around comfort and long-term health."
                  : intake.vertical === "ecommerce"
                    ? "Complete purchases with secure payment methods and straightforward return support."
                    : intake.vertical === "portfolio"
                      ? "Review responsive product and marketing websites built for performance and clarity."
                      : intake.vertical === "event"
                        ? "Connect with peers, sponsors, and partners through curated networking blocks."
                        : intake.vertical === "blog"
                          ? "Get new articles on a predictable cadence focused on your core interests."
                          : intake.vertical === "saas"
                            ? "Keep onboarding, collaboration, and reporting in one understandable product flow."
                            : `Our team understands the needs of ${intake.audience.toLowerCase()} and responds quickly.`,
                120
              )
            },
            {
              title: clamp(
                intake.vertical === "clinic"
                  ? "Emergency Visits"
                  : intake.vertical === "ecommerce"
                    ? "Fast Fulfillment"
                    : intake.vertical === "portfolio"
                      ? "Creative Direction"
                      : intake.vertical === "event"
                        ? "Practical Takeaways"
                        : intake.vertical === "blog"
                          ? "Community Insights"
                          : intake.vertical === "saas"
                            ? "Reliable Support"
                            : "Clear Next Steps",
                32
              ),
              description: clamp(
                intake.vertical === "clinic"
                  ? "Same-day support when urgent dental pain appears and fast follow-up care is needed."
                  : intake.vertical === "ecommerce"
                    ? "Track orders easily with clear shipping updates from checkout to delivery."
                    : intake.vertical === "portfolio"
                      ? "Understand strategy decisions behind each project with concise case-study context."
                      : intake.vertical === "event"
                        ? "Leave each session with frameworks and examples you can apply immediately."
                        : intake.vertical === "blog"
                          ? "Join discussion-driven content designed for informed readers and practitioners."
                          : intake.vertical === "saas"
                            ? "Reach the right action quickly with clear guides and responsive product support."
                            : "Visitors get a direct, focused path from first visit to first conversation.",
                120
              )
            }
          ]
        },
        media: [],
        ctas: []
      };
    case "feature_spotlight":
      if (intake.vertical === "restaurant") {
        return {
          id,
          type: "feature_spotlight",
          variant: "alternating",
          props: { items: 2 },
          copy: {
            items: [
              {
                eyebrow: clamp("Gallery", 24),
                title: clamp("Dining Space", 40),
                description: clamp(
                  "Browse the dining room and patio atmosphere before your reservation.",
                  160
                ),
                bullets: [
                  clamp("Comfortable indoor seating", 60),
                  clamp("Inviting evening ambience", 60)
                ]
              },
              {
                eyebrow: clamp("Gallery", 24),
                title: clamp("Plated Favorites", 40),
                description: clamp(
                  "Preview colorful entrées, desserts, and chef specials from the current menu.",
                  160
                ),
                bullets: [
                  clamp("Seasonal chef specials", 60),
                  clamp("House desserts and drinks", 60)
                ]
              }
            ]
          },
          media: [
            sectionMediaLocal("gallery", RESTAURANT_PLACEHOLDERS.gallery1, `${intake.brandName} food gallery image 1`, "4:3"),
            sectionMediaLocal("gallery", RESTAURANT_PLACEHOLDERS.gallery2, `${intake.brandName} ambience gallery image 2`, "4:3"),
            sectionMediaLocal("gallery", RESTAURANT_PLACEHOLDERS.gallery3, `${intake.brandName} dining gallery image 3`, "4:3")
          ],
          ctas: []
        };
      }

      if (intake.vertical === "clinic") {
        return {
          id,
          type: "feature_spotlight",
          variant: "alternating",
          props: { items: 2 },
          copy: {
            items: [
              {
                eyebrow: clamp("Meet the Team", 24),
                title: clamp("Dentists You Can Trust", 40),
                description: clamp(
                  "Our team combines modern techniques with a calm, patient-first approach for every visit.",
                  160
                ),
                bullets: [
                  clamp("Clear treatment explanations", 60),
                  clamp("Comfort-focused appointments", 60)
                ]
              },
              {
                eyebrow: clamp("Visit Dentiva", 24),
                title: clamp("Modern Clinic Environment", 40),
                description: clamp(
                  "Enjoy a clean, welcoming clinic designed to make routine and advanced care stress-free.",
                  160
                ),
                bullets: [clamp("Family-friendly care", 60), clamp("Flexible scheduling", 60)]
              }
            ]
          },
          media: [
            sectionMediaLocal("gallery", CLINIC_PLACEHOLDERS.team, `${intake.brandName} dental team clinic photo`, "4:3")
          ],
          ctas: []
        };
      }

      if (intake.vertical === "barbershop") {
        return {
          id,
          type: "feature_spotlight",
          variant: "alternating",
          props: { items: 2 },
          copy: {
            items: [
              {
                eyebrow: clamp("Booking Flow", 24),
                title: clamp("Fast appointments without the wait", 40),
                description: clamp(
                  "Show clients exactly how to secure a slot, arrive on time, and get through the chair efficiently.",
                  160
                ),
                bullets: [
                  clamp("Clear service selection", 60),
                  clamp("Simple appointment handoff", 60)
                ]
              },
              {
                eyebrow: clamp("Repeat Business", 24),
                title: clamp("Built for loyal returning clients", 40),
                description: clamp(
                  "Position the shop as the reliable go-to for regular cuts, beard maintenance, and consistent grooming.",
                  160
                ),
                bullets: [
                  clamp("Consistent service quality", 60),
                  clamp("Strong neighborhood trust", 60)
                ]
              }
            ]
          },
          media: [
            sectionMediaLocal(
              "gallery",
              HERO_MEDIA_BY_VERTICAL.barbershop,
              `${intake.brandName} barber tools and chair photo`,
              "4:3"
            )
          ],
          ctas: []
        };
      }

      return {
        id,
        type: "feature_spotlight",
        variant: "alternating",
        props: { items: 2 },
        copy: {
          items: [
            {
              eyebrow: clamp(intake.vertical === "portfolio" ? "Case Study" : "Overview", 24),
              title: clamp(
                intake.vertical === "ecommerce"
                  ? "Popular Product Lines"
                  : intake.vertical === "portfolio"
                    ? "Recent Client Work"
                    : intake.vertical === "event"
                      ? "Event Highlights"
                      : intake.vertical === "blog"
                        ? "Top Article Series"
                        : "What You Offer",
                40
              ),
              description: clamp(
                intake.vertical === "ecommerce"
                  ? "Discover product categories with clear pricing, trusted reviews, and simplified buying decisions."
                  : intake.vertical === "portfolio"
                    ? "Explore selected projects with goals, process, and measurable outcomes."
                    : intake.vertical === "event"
                      ? "Review key sessions, speaker themes, and event moments attendees value most."
                      : intake.vertical === "blog"
                        ? "Start with our most-read topics to quickly find practical insights."
                        : "Explain the primary service in plain language and keep benefits concrete.",
                160
              ),
              bullets: [
                clamp(intake.vertical === "ecommerce" ? "Clear product benefits" : "Lead with clear outcomes", 60),
                clamp(intake.vertical === "portfolio" ? "Visible before/after impact" : "Keep language customer-facing", 60)
              ]
            },
            {
              eyebrow: clamp(intake.vertical === "event" ? "Agenda" : "Execution", 24),
              title: clamp(
                intake.vertical === "ecommerce"
                  ? "Shipping and Support"
                  : intake.vertical === "portfolio"
                    ? "Collaboration Process"
                    : intake.vertical === "event"
                      ? "Plan Your Day"
                      : intake.vertical === "blog"
                        ? "Subscribe for Updates"
                        : "How It Works",
                40
              ),
              description: clamp(
                intake.vertical === "ecommerce"
                  ? "Get fulfillment timelines, transparent policies, and responsive support in one place."
                  : intake.vertical === "portfolio"
                    ? "See how we scope, iterate, and deliver work with clear communication milestones."
                    : intake.vertical === "event"
                      ? "Choose tracks, sessions, and networking blocks that match your goals."
                      : intake.vertical === "blog"
                        ? "Receive new insights regularly and never miss important updates."
                        : "Describe the engagement flow so visitors know what happens next.",
                160
              ),
              bullets: [
                clamp(intake.vertical === "event" ? "Curated session tracks" : "Simple first step", 60),
                clamp(intake.vertical === "blog" ? "Weekly content cadence" : "Fast follow-up", 60)
              ]
            }
          ]
        },
        media: [],
        ctas: []
      };
    case "metrics": {
      const metrics = parsePromptMetrics(rawPrompt);
      return {
        id,
        type: "metrics",
        variant: "row",
        props: {},
        copy: {
          items: metrics.map((metric) => ({ value: clamp(metric.value, 12), label: clamp(metric.label, 28) }))
        },
        media: [],
        ctas: []
      };
    }
    case "testimonials":
      if (intake.vertical === "restaurant") {
        return {
          id,
          type: "testimonials",
          variant: "cards",
          props: { count: 2 },
          copy: {
            items: [
              {
                quote: clamp(
                  "The menu had fresh flavors and the staff made our dinner feel effortless from start to finish.",
                  220
                ),
                name: clamp("A. Rivera", 32),
                title: clamp("Dinner Guest", 48)
              },
              {
                quote: clamp(
                  "We booked ahead and everything was ready when we arrived. Great ambience and excellent service.",
                  220
                ),
                name: clamp("M. Patel", 32),
                title: clamp("Returning Diner", 48)
              }
            ]
          },
          media: [],
          ctas: []
        };
      }

      if (intake.vertical === "clinic") {
        return {
          id,
          type: "testimonials",
          variant: "cards",
          props: { count: 2 },
          copy: {
            items: [
              {
                quote: clamp(
                  "From reception to treatment, the team made me feel informed and comfortable at every step.",
                  220
                ),
                name: clamp("Sarah M.", 32),
                title: clamp("Patient", 48)
              },
              {
                quote: clamp(
                  "I booked quickly, got clear advice, and my smile has never felt better after treatment.",
                  220
                ),
                name: clamp("James T.", 32),
                title: clamp("Patient", 48)
              }
            ]
          },
          media: [
            sectionMediaLocal("avatar", CLINIC_PLACEHOLDERS.testimonials, `${intake.brandName} patient testimonial photo`, "1:1")
          ],
          ctas: []
        };
      }

      return {
        id,
        type: "testimonials",
        variant: "cards",
        props: { count: 2 },
        copy: {
          items: [
            {
              quote: clamp(
                intake.vertical === "saas"
                  ? "The product walkthrough made onboarding simple for our entire team and reduced back-and-forth."
                  : intake.vertical === "ecommerce"
                    ? "Checkout was smooth, delivery updates were clear, and support answered quickly."
                    : intake.vertical === "portfolio"
                      ? "The project quality and communication were excellent from kickoff through delivery."
                      : intake.vertical === "event"
                        ? "Sessions were practical and the networking opportunities were genuinely valuable."
                        : intake.vertical === "blog"
                          ? "Articles are concise, useful, and easy to apply in day-to-day work."
                          : "The service team communicated clearly and delivered exactly what we needed.",
                220
              ),
              name: clamp(intake.vertical === "event" ? "Event Attendee" : "Verified Customer", 32),
              title: clamp(intake.vertical === "saas" ? "Product Team" : "Client", 48)
            },
            {
              quote: clamp(
                intake.vertical === "saas"
                  ? "We adopted the workflow fast and saw immediate clarity across operations."
                  : intake.vertical === "ecommerce"
                    ? "Product details matched expectations and returns were straightforward when needed."
                    : intake.vertical === "portfolio"
                      ? "Creative direction and execution stayed aligned with our brand goals."
                      : intake.vertical === "event"
                        ? "The agenda was well-paced and every block had clear takeaways."
                        : intake.vertical === "blog"
                          ? "Content quality stays high and each post delivers practical insight."
                          : "The process was smooth from first call to completion and follow-up.",
                220
              ),
              name: clamp(intake.vertical === "blog" ? "Subscriber" : "Returning Customer", 32),
              title: clamp(intake.vertical === "portfolio" ? "Marketing Lead" : "Customer", 48)
            }
          ]
        },
        media: [],
        ctas: []
      };
    case "pricing":
      return {
        id,
        type: "pricing",
        variant: "cards",
        props: { plans: intake.siteType === "saas" ? 3 : 2 },
        copy: {
          title: clamp("Simple Pricing", 40),
          plans: [
            {
              name: clamp("Starter", 20),
              price: clamp("$29", 16),
              description: clamp("Essential features for small teams.", 80),
              features: [
                clamp("Core feature set", 60),
                clamp("Email support", 60),
                clamp("Weekly updates", 60)
              ],
              ctaLabel: clamp(planPrimaryLabel, 20)
            },
            {
              name: clamp("Growth", 20),
              price: clamp("$99", 16),
              description: clamp("For teams scaling their workflow.", 80),
              features: [
                clamp("Expanded feature set", 60),
                clamp("Priority support", 60),
                clamp("Advanced reporting", 60)
              ],
              ctaLabel: clamp(planPrimaryLabel, 20)
            }
          ].concat(
            intake.siteType === "saas"
              ? [
                  {
                    name: clamp("Scale", 20),
                    price: clamp("$249", 16),
                    description: clamp("Best for larger organizations.", 80),
                    features: [
                      clamp("Enterprise controls", 60),
                      clamp("Dedicated onboarding", 60),
                      clamp("Custom integrations", 60)
                    ],
                    ctaLabel: clamp(planPrimaryLabel, 20)
                  }
                ]
              : []
          )
        },
        media: [],
        ctas: []
      };
    case "faq":
      if (intake.vertical === "barbershop") {
        return {
          id,
          type: "faq",
          variant: "accordion",
          props: { items: 4 },
          copy: {
            items: [
              {
                q: clamp("Do I need to book in advance?", 80),
                a: clamp("Booking ahead is recommended for peak hours so you can lock a time that fits your day.", 220)
              },
              {
                q: clamp("What services can I choose from?", 80),
                a: clamp("Use the services section to compare cut, beard, and grooming options before you book.", 220)
              },
              {
                q: clamp("How long does an appointment take?", 80),
                a: clamp("Most appointments are structured to stay efficient while still leaving time for detail work.", 220)
              },
              {
                q: clamp("Can I come back regularly with the same barber?", 80),
                a: clamp("Yes. The flow is designed for repeat clients who want a consistent result every visit.", 220)
              }
            ]
          },
          media: [],
          ctas: []
        };
      }

      return {
        id,
        type: "faq",
        variant: "accordion",
        props: { items: 4 },
        copy: {
          items: [
            {
              q: clamp("How do we get started?", 80),
              a: clamp("Use the primary action above and we will guide you through the next steps.", 220)
            },
            {
              q: clamp("How quickly will we hear back?", 80),
              a: clamp("Most requests receive a response within one business day.", 220)
            },
            {
              q: clamp("Can we request custom options?", 80),
              a: clamp("Yes. Share your requirements and we will tailor the proposal.", 220)
            },
            {
              q: clamp("Is this suitable for small teams?", 80),
              a: clamp("Yes. The offering is structured to work for both small and growing teams.", 220)
            }
          ]
        },
        media: [],
        ctas: []
      };
    case "cta_banner":
      if (intake.vertical === "restaurant") {
        return {
          id,
          type: "cta_banner",
          variant: "simple",
          props: {},
          copy: {
            title: clamp("Reserve Your Table", 50),
            subtitle: clamp("Book dinner now or explore the full menu before your visit.", 140),
            ctaLabel: clamp(planPrimaryLabel, 20)
          },
          media: [],
          ctas: [{ intent: "primary", label: clamp(planPrimaryLabel, 20), href: planPrimaryHref, style: "primary" }]
        };
      }

      if (intake.vertical === "clinic") {
        return {
          id,
          type: "cta_banner",
          variant: "simple",
          props: {},
          copy: {
            title: clamp("Book Your Dental Visit", 50),
            subtitle: clamp("Schedule an appointment today and get a treatment plan tailored to your smile.", 140),
            ctaLabel: clamp(planPrimaryLabel, 20)
          },
          media: [
            sectionMediaLocal("background", CLINIC_PLACEHOLDERS.cta, `${intake.brandName} clinic appointment photo`, "16:9")
          ],
          ctas: [{ intent: "primary", label: clamp(planPrimaryLabel, 20), href: planPrimaryHref, style: "primary" }]
        };
      }

      if (intake.vertical === "barbershop") {
        return {
          id,
          type: "cta_banner",
          variant: "simple",
          props: {},
          copy: {
            title: clamp("Lock in your next appointment", 50),
            subtitle: clamp("Choose the service, pick the slot, and make your next visit feel easy from the first click.", 140),
            ctaLabel: clamp(planPrimaryLabel, 20)
          },
          media: [],
          ctas: [{ intent: "primary", label: clamp(planPrimaryLabel, 20), href: planPrimaryHref, style: "primary" }]
        };
      }

      return {
        id,
        type: "cta_banner",
        variant: "simple",
        props: {},
        copy: {
          title: clamp(
            intake.vertical === "ecommerce"
              ? "Shop Best Sellers"
              : intake.vertical === "portfolio"
                ? "Start Your Project"
                : intake.vertical === "event"
                  ? "Reserve Your Spot"
                  : intake.vertical === "blog"
                    ? "Subscribe for New Posts"
                    : intake.vertical === "saas"
                      ? "Request a Product Demo"
                      : "Contact Our Team",
            50
          ),
          subtitle: clamp(
            intake.vertical === "ecommerce"
              ? "Browse featured products and complete your order in minutes."
              : intake.vertical === "portfolio"
                ? "Share your brief and timeline to receive a tailored proposal."
                : intake.vertical === "event"
                  ? "Secure your ticket and review the full event agenda."
                  : intake.vertical === "blog"
                    ? "Get practical updates delivered whenever new articles are published."
                    : intake.vertical === "saas"
                      ? "See how the platform fits your workflow in a guided walkthrough."
                      : "Reach out for availability, pricing, and next-step guidance.",
            140
          ),
          ctaLabel: clamp(planPrimaryLabel, 20)
        },
        media: [],
        ctas: [{ intent: "primary", label: clamp(planPrimaryLabel, 20), href: planPrimaryHref, style: "primary" }]
      };
    case "contact":
      if (intake.vertical === "restaurant") {
        return {
          id,
          type: "contact",
          variant: "simple",
          props: {
            fields: ["name", "email", "message"]
          },
          copy: {
            title: clamp("Hours & Location", 40),
            subtitle: clamp("Visit us daily and use reservations for peak dinner hours.", 140),
            submitLabel: clamp("Request a Table", 20)
          },
          media: [],
          ctas: [
            {
              intent: "primary",
              label: clamp("Book a Table", 20),
              href: "/#reservations",
              style: "secondary"
            }
          ]
        };
      }

      if (intake.vertical === "clinic") {
        return {
          id,
          type: "contact",
          variant: "simple",
          props: {
            fields: ["name", "email", "message"]
          },
          copy: {
            title: clamp("Contact & Appointments", 40),
            subtitle: clamp("Call or message us to book your visit and get help with treatment questions.", 140),
            submitLabel: clamp("Book Appointment", 20)
          },
          media: [],
          ctas: [{ intent: "primary", label: clamp("Book a Visit", 20), href: "/#contact", style: "secondary" }]
        };
      }

      if (intake.vertical === "barbershop") {
        return {
          id,
          type: "contact",
          variant: "simple",
          props: {
            fields: ["name", "email", "message"]
          },
          copy: {
            title: clamp("Appointments & Shop Questions", 40),
            subtitle: clamp("Send your preferred time, service, or grooming question and the team can guide the next step.", 140),
            submitLabel: clamp("Request Appointment", 20)
          },
          media: [],
          ctas: [{ intent: "primary", label: clamp(planPrimaryLabel, 20), href: planPrimaryHref, style: "secondary" }]
        };
      }

      return {
        id,
        type: "contact",
        variant: "simple",
        props: {
          fields: intake.vertical === "blog" ? ["email"] : ["name", "email", "message"]
        },
        copy: {
          title: clamp(
            intake.vertical === "ecommerce"
              ? "Customer Support"
              : intake.vertical === "portfolio"
                ? "Project Inquiry"
                : intake.vertical === "event"
                  ? "Event Questions"
                  : intake.vertical === "blog"
                    ? "Newsletter Signup"
                    : intake.vertical === "saas"
                      ? "Contact Sales"
                      : "Contact",
            40
          ),
          subtitle: clamp(
            intake.vertical === "ecommerce"
              ? "Need help with orders, shipping, or returns? Send us a message."
              : intake.vertical === "portfolio"
                ? "Share your project goals and we will follow up with scope and timeline."
                : intake.vertical === "event"
                  ? "Ask about tickets, speakers, venue details, or group attendance."
                  : intake.vertical === "blog"
                    ? "Subscribe to receive new articles and practical updates."
                    : intake.vertical === "saas"
                      ? "Tell us your workflow goals and we will schedule the right demo."
                      : "Share your goals and timeline, and we will reply with next steps.",
            140
          ),
          submitLabel: clamp(
            intake.vertical === "blog"
              ? "Subscribe"
              : intake.vertical === "ecommerce"
                ? "Send Support Request"
                : intake.vertical === "event"
                  ? "Send Event Question"
                  : "Send Request",
            20
          )
        },
        media: [],
        ctas: [
          {
            intent: "primary",
            label: clamp(planPrimaryLabel, 20),
            href: planPrimaryHref,
            style: "secondary"
          }
        ]
      };
    case "footer":
      if (intake.vertical === "restaurant") {
        return {
          id,
          type: "footer",
          variant: "simple",
          props: {},
          copy: {
            columns: [
              {
                title: clamp("Explore", 20),
                links: [
                  { label: clamp("Menu", 20), href: "/#menu" },
                  { label: clamp("Reservations", 20), href: "/#reservations" }
                ]
              },
              {
                title: clamp("Restaurant", 20),
                links: [
                  { label: clamp("About", 20), href: "/#about" },
                  { label: clamp("Contact", 20), href: "/#contact" }
                ]
              }
            ]
          },
          media: [],
          ctas: []
        };
      }

      if (intake.vertical === "clinic") {
        return {
          id,
          type: "footer",
          variant: "simple",
          props: {},
          copy: {
            columns: [
              {
                title: clamp("Care", 20),
                links: [
                  { label: clamp("Services", 20), href: "/#services" },
                  { label: clamp("Testimonials", 20), href: "/#testimonials" }
                ]
              },
              {
                title: clamp("Clinic", 20),
                links: [
                  { label: clamp("About", 20), href: "/#about" },
                  { label: clamp("Contact", 20), href: "/#contact" }
                ]
              }
            ]
          },
          media: [],
          ctas: []
        };
      }

      if (intake.vertical === "barbershop") {
        return {
          id,
          type: "footer",
          variant: "simple",
          props: {},
          copy: {
            columns: [
              {
                title: clamp("Book", 20),
                links: [
                  { label: clamp("Services", 20), href: "/#services" },
                  { label: clamp("Contact", 20), href: "/#contact" }
                ]
              },
              {
                title: clamp("Shop", 20),
                links: [
                  { label: clamp("Experience", 20), href: "/#about" },
                  { label: clamp("Reviews", 20), href: "/#testimonials" }
                ]
              }
            ]
          },
          media: [],
          ctas: []
        };
      }

      return {
        id,
        type: "footer",
        variant: "simple",
        props: {},
        copy: {
          columns: [
            {
              title: clamp(
                intake.vertical === "saas"
                  ? "Product"
                  : intake.vertical === "ecommerce"
                    ? "Shop"
                    : intake.vertical === "portfolio"
                      ? "Work"
                      : intake.vertical === "event"
                        ? "Event"
                        : intake.vertical === "blog"
                          ? "Content"
                          : "Business",
                20
              ),
              links: [
                {
                  label: clamp(
                    intake.vertical === "saas"
                      ? "Features"
                      : intake.vertical === "ecommerce"
                        ? "Shop"
                        : intake.vertical === "portfolio"
                          ? "Projects"
                          : intake.vertical === "event"
                            ? "Agenda"
                            : intake.vertical === "blog"
                              ? "Latest Posts"
                              : "Services",
                    20
                  ),
                  href:
                    intake.vertical === "saas"
                      ? "/#features"
                      : intake.vertical === "ecommerce"
                        ? "/#shop"
                        : intake.vertical === "portfolio"
                          ? "/#work"
                          : intake.vertical === "event"
                            ? "/#agenda"
                            : intake.vertical === "blog"
                              ? "/#latest"
                              : "/#services"
                },
                {
                  label: clamp(
                    intake.vertical === "saas"
                      ? "Pricing"
                      : intake.vertical === "ecommerce"
                        ? "Support"
                        : intake.vertical === "portfolio"
                          ? "Testimonials"
                          : intake.vertical === "event"
                            ? "Tickets"
                            : intake.vertical === "blog"
                              ? "Topics"
                              : "Testimonials",
                    20
                  ),
                  href:
                    intake.vertical === "saas"
                      ? "/#pricing"
                      : intake.vertical === "ecommerce"
                        ? "/#contact"
                        : intake.vertical === "portfolio"
                          ? "/#testimonials"
                          : intake.vertical === "event"
                            ? "/#tickets"
                            : intake.vertical === "blog"
                              ? "/#topics"
                              : "/#testimonials"
                }
              ]
            },
            {
              title: clamp("Company", 20),
              links: [
                { label: clamp("About", 20), href: "/#about" },
                { label: clamp("Contact", 20), href: "/#contact" }
              ]
            }
          ]
        },
        media: [],
        ctas: []
      };
    default:
      throw new Error(`Unsupported section type: ${sectionType}`);
  }
};

const deriveThemeAccent = (seed: number, intake: IntakeBrief): ThemeAccent => {
  if (intake.locks.accent) return intake.theme.accent;
  return pickBySeed(seed, THEME_ACCENTS);
};

const deriveThemeFont = (seed: number, intake: IntakeBrief): ThemeFont => {
  if (intake.locks.font) return intake.theme.font;
  return pickBySeed(seed, ["sans", "serif"] as const);
};

const GENERIC_CTA_LABELS = new Set(["get started", "learn more", "contact us"]);

const normalizeSectionSet = (
  candidate: WebsitePlan,
  deterministic: WebsitePlan,
  intake: IntakeBrief,
  rawPrompt: string
) : WebsitePlanSection[] => {
  const orderedTypes = normalizeOrder(intake, rawPrompt);
  const byType = new Map<WebsitePlanSection["type"], WebsitePlanSection>(
    candidate.sections.map((section) => [section.type, section])
  );

  return orderedTypes.map((type, index) => {
    const fallback = deterministic.sections.find((section) => section.type === type);
    const next = byType.get(type) ?? fallback;
    if (!next || !fallback) {
      throw new Error(`Missing normalized section '${type}'`);
    }

    return {
      ...next,
      id: fallback.id,
      type
    } as WebsitePlanSection;
  });
};

const normalizeCtaSet = (candidate: WebsitePlan, deterministic: WebsitePlan, intake: IntakeBrief) => {
  const primaryLabel = candidate.cta?.primary?.label?.trim().toLowerCase() ?? "";
  const shouldForcePrimary =
    intake.vertical === "restaurant" ||
    intake.vertical === "clinic" ||
    intake.vertical === "barbershop" ||
    GENERIC_CTA_LABELS.has(primaryLabel);

  const primary = shouldForcePrimary ? deterministic.cta.primary : candidate.cta.primary;
  const secondaryLabel = candidate.cta?.secondary?.label?.trim().toLowerCase() ?? "";
  const secondary =
    candidate.cta?.secondary && !GENERIC_CTA_LABELS.has(secondaryLabel)
      ? candidate.cta.secondary
      : deterministic.cta.secondary;

  return { primary, secondary };
};

const variationDirection = (intake: IntakeBrief, index: number) => {
  const localBusinessDirections = [
    "Lead with transformation and first-impression outcomes.",
    "Lead with speed, convenience, and low-friction booking.",
    "Lead with credibility, repeat business, and local trust."
  ];

  if (["barbershop", "local_business", "clinic"].includes(intake.vertical)) {
    return localBusinessDirections[index % localBusinessDirections.length];
  }

  const genericDirections = [
    "Lead with strongest customer outcome.",
    "Lead with clarity and premium presentation.",
    "Lead with conversion-focused specificity."
  ];

  return genericDirections[index % genericDirections.length];
};

const deriveCtas = (intake: IntakeBrief) => {
  if (intake.vertical === "restaurant") {
    return {
      primary: {
        label: "Book a Table",
        href: "/#reservations",
        style: "primary" as const
      },
      secondary: {
        label: "View Menu",
        href: "/#menu",
        style: "ghost" as const
      }
    };
  }

  if (intake.vertical === "clinic") {
    return {
      primary: {
        label: "Book a Visit",
        href: "/#contact",
        style: "primary" as const
      },
      secondary: {
        label: "Our Services",
        href: "/#services",
        style: "ghost" as const
      }
    };
  }

  if (intake.vertical === "barbershop") {
    return {
      primary: {
        label: primaryGoalLabel(intake.brief.primaryCtaGoal || "book_appointment"),
        href: primaryGoalHref(intake.brief.primaryCtaGoal || "book_appointment"),
        style: "primary" as const
      },
      secondary: {
        label: "See Services",
        href: "/#services",
        style: "ghost" as const
      }
    };
  }

  if (intake.vertical === "ecommerce") {
    return {
      primary: {
        label: "Shop Now",
        href: "/#shop",
        style: "primary" as const
      },
      secondary: {
        label: "View Products",
        href: "/#shop",
        style: "ghost" as const
      }
    };
  }

  if (intake.vertical === "portfolio") {
    return {
      primary: {
        label: "Start Project",
        href: "/#contact",
        style: "primary" as const
      },
      secondary: {
        label: "View Work",
        href: "/#work",
        style: "ghost" as const
      }
    };
  }

  if (intake.vertical === "event") {
    return {
      primary: {
        label: "Get Tickets",
        href: "/#tickets",
        style: "primary" as const
      },
      secondary: {
        label: "View Agenda",
        href: "/#agenda",
        style: "ghost" as const
      }
    };
  }

  if (intake.vertical === "blog") {
    return {
      primary: {
        label: "Read Articles",
        href: "/#latest",
        style: "primary" as const
      },
      secondary: {
        label: "Subscribe",
        href: "/#contact",
        style: "ghost" as const
      }
    };
  }

  if (intake.vertical === "local_business") {
    return {
      primary: {
        label: primaryGoalLabel(intake.brief.primaryCtaGoal || "get_quote"),
        href: primaryGoalHref(intake.brief.primaryCtaGoal || "get_quote"),
        style: "primary" as const
      },
      secondary: {
        label: "Our Services",
        href: "/#services",
        style: "ghost" as const
      }
    };
  }

  const primaryLabel = CTA_LABEL_BY_GOAL[intake.primaryGoal];
  const primaryHref = CTA_HREF_BY_GOAL[intake.primaryGoal];

  return {
    primary: {
      label: clamp(primaryLabel, 20),
      href: primaryHref,
      style: "primary" as const
    },
    secondary: {
      label: clamp("Contact Us", 20),
      href: "/#contact",
      style: "ghost" as const
    }
  };
};

const buildDeterministicPlan = (intake: IntakeBrief, rawPrompt: string): WebsitePlan => {
  const seed = hashString(`${rawPrompt}::${intake.brandName}::${intake.vertical}`);
  const sectionOrder = normalizeOrder(intake, rawPrompt);
  const cta = deriveCtas(intake);

  const sections = sectionOrder.map((sectionType, index) =>
    buildSection(
      sectionType,
      intake,
      index,
      rawPrompt,
      seed + index,
      cta.primary.label,
      cta.primary.href,
      cta.secondary.label,
      cta.secondary.href
    )
  );

  return {
    version: "1.0",
    meta: {
      locale: resolveLocaleFromLanguage(intake.language),
      vertical: intake.vertical,
      siteType: intake.siteType,
      primaryGoal: intake.primaryGoal,
      brandName: clamp(intake.brandName, 48),
      logoUrl: intake.logoUrl ?? undefined,
      pageTitle: clamp(`${intake.brandName} | ${sentenceCase(intake.offer)}`, 60),
      pageDescription: clamp(`${intake.brandName} helps ${intake.audience} with ${intake.offer}.`, 160)
    },
    theme: {
      mode: intake.theme.mode,
      tone: intake.tone,
      density: intake.density,
      radius: pickBySeed(seed, ["sm", "md", "lg"] as const),
      accent: deriveThemeAccent(seed, intake),
      font: deriveThemeFont(seed, intake)
    },
    cta,
    sections
  };
};

const normalizeGeneratedPlan = (candidate: WebsitePlan, intake: IntakeBrief, rawPrompt: string) => {
  const deterministic = buildDeterministicPlan(intake, rawPrompt);
  const merged: WebsitePlan = {
    ...candidate,
    version: "1.0",
    meta: {
      ...candidate.meta,
      locale: resolveLocaleFromLanguage(intake.language),
      vertical: intake.vertical,
      siteType: intake.siteType,
      primaryGoal: intake.primaryGoal,
      brandName: clamp(candidate.meta.brandName || intake.brandName, 48),
      logoUrl: intake.logoUrl ?? candidate.meta.logoUrl ?? undefined,
      pageTitle: clamp(candidate.meta.pageTitle || deterministic.meta.pageTitle, 60),
      pageDescription: clamp(candidate.meta.pageDescription || deterministic.meta.pageDescription, 160)
    },
    theme: {
      ...deterministic.theme,
      mode: intake.theme.mode,
      tone: intake.tone,
      density: intake.density,
      accent: intake.locks.accent ? intake.theme.accent : deterministic.theme.accent,
      font: intake.locks.font ? intake.theme.font : deterministic.theme.font
    },
    cta: normalizeCtaSet(candidate, deterministic, intake),
    sections: normalizeSectionSet(candidate, deterministic, intake, rawPrompt)
  };

  return merged;
};

export async function buildWebsitePlan(
  intake: IntakeBrief,
  rawPrompt: string,
  openai?: any,
  validationFeedback: string[] = [],
  options?: {
    qualityMode?: QualityMode;
    candidateIndex?: number;
  }
): Promise<WebsitePlan> {
  const deterministic = buildDeterministicPlan(intake, rawPrompt);

  if (!openai) {
    return deterministic;
  }

  const payload = [
    PROMPT_STAGE_1_PLAN,
    `Vertical: ${intake.vertical}`,
    `BusinessNiche: ${intake.businessNiche ?? intake.vertical}`,
    `Language: ${intake.language}`,
    `Locale: ${resolveLocaleFromLanguage(intake.language)}`,
    `SiteType: ${intake.siteType}`,
    `PrimaryGoal: ${intake.primaryGoal}`,
    `QualityMode: ${options?.qualityMode ?? "balanced"}`,
    `VariationDirection: ${variationDirection(intake, options?.candidateIndex ?? 0)}`,
    `BusinessBrief: ${JSON.stringify(intake.brief)}`,
    `Audience: ${intake.audience}`,
    `Offer: ${intake.offer}`,
    `ThemeLocks: ${JSON.stringify(intake.locks)}`,
    `ThemeConstraints: ${JSON.stringify(intake.theme)}`,
    `MustHaveSections: ${JSON.stringify(intake.mustHaveSections)}`,
    `MustAvoid: ${JSON.stringify(intake.mustAvoid)}`,
    `AllowPricingForRestaurant: ${String(intake.allowPricingForRestaurant)}`,
    `AllowedSectionsForVertical: ${JSON.stringify(allowedSectionsByVertical[intake.vertical])}`,
    `RecommendedOrder: ${JSON.stringify(defaultOrderByVertical[intake.vertical])}`,
    `TokenClamps: ${JSON.stringify(TOKEN_CLAMPS)}`,
    `RawPrompt:\n${rawPrompt}`
  ]
    .concat(validationFeedback.length ? [`ValidationErrors:\n${validationFeedback.join("\n")}`] : [])
    .join("\n\n");

  const generated = await runStrictJsonWithRetry(openai, {
    schema: WebsitePlanSchema,
    userPrompt: payload,
    systemPrompt: "You are a strict planner. Return only valid WebsitePlan JSON.",
    temperature:
      options?.qualityMode === "best" ? 0.35 : options?.qualityMode === "fast" ? 0.12 : 0.24,
    label: "v0-like-plan"
  });

  if (!generated) {
    return deterministic;
  }

  const normalized = normalizeGeneratedPlan(generated, intake, rawPrompt);
  const validated = validateWebsitePlan(normalized);
  if (!validated.ok) {
    return deterministic;
  }

  return validated.value;
}
