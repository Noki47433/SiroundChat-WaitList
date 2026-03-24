import type { WebsitePlanSection } from "@/src/generation/v0_like/schema";
import type { SectionType, SiteType, Vertical } from "@/src/generation/v0_like/types";

export type RegistryRenderContext = {
  brandName: string;
  paddingClass: string;
  containerClass: string;
  h1Class: string;
  h2Class: string;
  bodyClass: string;
  gapClass: string;
  sectionClassByType: Partial<Record<SectionType, string>>;
  buttonClassByStyle: Record<"primary" | "secondary" | "ghost", string>;
};

export type RegistryRenderFn = (section: WebsitePlanSection, ctx: RegistryRenderContext) => string;

export type RegistryEntry = {
  variants: readonly string[];
  renderFn: RegistryRenderFn;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderMediaNode = (sectionId: string, media: WebsitePlanSection["media"][number], index: number) => {
  const alt = escapeHtml(media.alt);
  if (media.source === "placeholder") {
    return `<div data-media="placeholder" data-aspect="${media.aspectRatio}" role="img" aria-label="${alt}" class="h-48 w-full rounded-xl border border-dashed border-slate-300 bg-slate-100"></div>`;
  }
  return `<Image src="${escapeHtml(media.src)}" alt="${alt}" width={1280} height={720} className="h-auto w-full rounded-xl" data-section="${sectionId}" data-index="${index}" />`;
};

const renderSectionWrapper = (
  tag: "section" | "header" | "footer",
  section: WebsitePlanSection,
  ctx: RegistryRenderContext,
  inner: string
) => {
  const sectionClass = ctx.sectionClassByType[section.type] ?? "";
  return `<${tag} id="${section.id}" className="${ctx.paddingClass} ${sectionClass}"><div className="mx-auto ${ctx.containerClass}">${inner}</div></${tag}>`;
};

const renderHeader: RegistryRenderFn = (section, ctx) => {
  const header = section as Extract<WebsitePlanSection, { type: "header" }>;
  const links = header.copy.links
    .map(
      (link) =>
        `<a href="${escapeHtml(link.href)}" className="text-sm font-medium text-slate-700 hover:text-slate-900">${escapeHtml(link.label)}</a>`
    )
    .join("");
  const logoMedia = header.media.find((media) => media.role === "logo" && media.source === "user" && media.src.trim());
  const logoNode = logoMedia
    ? `<span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white"><Image src="${escapeHtml(
        logoMedia.src
      )}" alt="${escapeHtml(logoMedia.alt)}" width={40} height={40} className="h-10 w-10 object-contain" /></span>`
    : "";
  const brandNode = `<span className="text-sm font-semibold tracking-wide text-slate-900">${escapeHtml(ctx.brandName)}</span>`;

  return renderSectionWrapper(
    "header",
    section,
    ctx,
    `<nav aria-label="Primary" className="flex items-center justify-between ${ctx.gapClass}"><div className="flex items-center ${ctx.gapClass}">${logoNode}${brandNode}</div><div className="flex items-center ${ctx.gapClass}">${links}</div></nav>`
  );
};

const renderHero: RegistryRenderFn = (section, ctx) => {
  const hero = section as Extract<WebsitePlanSection, { type: "hero" }>;
  const badge = hero.copy.badge ? `<p className="text-sm font-medium text-slate-500">${escapeHtml(hero.copy.badge)}</p>` : "";
  const media = hero.media[0] ? renderMediaNode(hero.id, hero.media[0], 0) : "";

  return renderSectionWrapper(
    "section",
    section,
    ctx,
    `<div className="grid ${ctx.gapClass} md:grid-cols-2 md:items-center">` +
      `<div className="space-y-4">${badge}<h1 className="${ctx.h1Class} font-semibold text-slate-900">${escapeHtml(
        hero.copy.headline
      )}</h1><p className="${ctx.bodyClass} text-slate-600">${escapeHtml(hero.copy.subheadline)}</p><div className="flex ${ctx.gapClass}"><a href="${escapeHtml(
        hero.ctas[0]?.href ?? "/"
      )}" className="${ctx.buttonClassByStyle.primary}">${escapeHtml(hero.copy.primaryCtaLabel)}</a>${
        hero.copy.secondaryCtaLabel
          ? `<a href="${escapeHtml(hero.ctas[1]?.href ?? "/")}" className="${ctx.buttonClassByStyle.secondary}">${escapeHtml(
              hero.copy.secondaryCtaLabel
            )}</a>`
          : ""
      }</div></div>` +
      `<div>${media}</div></div>`
  );
};

const renderLogos: RegistryRenderFn = (section, ctx) => {
  const logos = section as Extract<WebsitePlanSection, { type: "logos" }>;
  const label = logos.copy.label ? `<p className="${ctx.bodyClass} text-slate-500">${escapeHtml(logos.copy.label)}</p>` : "";
  const items = logos.media
    .map((media, index) => `<li className="rounded-lg border border-slate-200 p-3">${renderMediaNode(logos.id, media, index)}</li>`)
    .join("");

  return renderSectionWrapper(
    "section",
    section,
    ctx,
    `<div className="space-y-4">${label}<ul className="grid ${ctx.gapClass} md:grid-cols-${String(
      logos.props.columns
    )}">${items}</ul></div>`
  );
};

const renderFeatures: RegistryRenderFn = (section, ctx) => {
  const features = section as Extract<WebsitePlanSection, { type: "features" }>;
  const cards = features.copy.items
    .map(
      (item) =>
        `<li className="rounded-xl border border-slate-200 p-6"><h3 className="text-lg font-semibold text-slate-900">${escapeHtml(
          item.title
        )}</h3><p className="mt-2 ${ctx.bodyClass} text-slate-600">${escapeHtml(item.description)}</p></li>`
    )
    .join("");

  return renderSectionWrapper(
    "section",
    section,
    ctx,
    `<div className="space-y-6"><h2 className="${ctx.h2Class} font-semibold text-slate-900">${escapeHtml(
      features.copy.title
    )}</h2><ul className="grid ${ctx.gapClass} md:grid-cols-${String(features.props.columns)}">${cards}</ul></div>`
  );
};

const renderFeatureSpotlight: RegistryRenderFn = (section, ctx) => {
  const spotlight = section as Extract<WebsitePlanSection, { type: "feature_spotlight" }>;
  const blocks = spotlight.copy.items
    .map((item, index) => {
      const bullets = item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("");
      return `<article className="grid ${ctx.gapClass} md:grid-cols-2 md:items-start"><div className="space-y-2 ${
        index % 2 === 1 ? "md:order-2" : ""
      }"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(
        item.eyebrow
      )}</p><h3 className="text-2xl font-semibold text-slate-900">${escapeHtml(item.title)}</h3><p className="${ctx.bodyClass} text-slate-600">${escapeHtml(
        item.description
      )}</p><ul className="list-disc pl-6 ${ctx.bodyClass} text-slate-600">${bullets}</ul></div></article>`;
    })
    .join("");

  return renderSectionWrapper("section", section, ctx, `<div className="space-y-8">${blocks}</div>`);
};

const renderMetrics: RegistryRenderFn = (section, ctx) => {
  const metrics = section as Extract<WebsitePlanSection, { type: "metrics" }>;
  const items = metrics.copy.items
    .map(
      (item) =>
        `<li className="rounded-xl border border-slate-200 p-6"><p className="text-3xl font-bold text-slate-900">${escapeHtml(
          item.value
        )}</p><p className="mt-2 ${ctx.bodyClass} text-slate-600">${escapeHtml(item.label)}</p></li>`
    )
    .join("");

  return renderSectionWrapper("section", section, ctx, `<ul className="grid ${ctx.gapClass} md:grid-cols-3">${items}</ul>`);
};

const renderTestimonials: RegistryRenderFn = (section, ctx) => {
  const testimonials = section as Extract<WebsitePlanSection, { type: "testimonials" }>;
  const cards = testimonials.copy.items
    .map(
      (item) =>
        `<li className="rounded-xl border border-slate-200 p-6"><blockquote className="${ctx.bodyClass} text-slate-700">\"${escapeHtml(
          item.quote
        )}\"</blockquote><p className="mt-4 text-sm font-semibold text-slate-900">${escapeHtml(item.name)}</p><p className="text-sm text-slate-500">${escapeHtml(
          item.title
        )}</p></li>`
    )
    .join("");

  return renderSectionWrapper("section", section, ctx, `<ul className="grid ${ctx.gapClass} md:grid-cols-3">${cards}</ul>`);
};

const renderPricing: RegistryRenderFn = (section, ctx) => {
  const pricing = section as Extract<WebsitePlanSection, { type: "pricing" }>;
  const plans = pricing.copy.plans
    .map((plan) => {
      const features = plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("");
      return `<li className="rounded-xl border border-slate-200 p-6"><h3 className="text-xl font-semibold text-slate-900">${escapeHtml(
        plan.name
      )}</h3><p className="mt-2 text-3xl font-bold text-slate-900">${escapeHtml(plan.price)}</p><p className="mt-2 ${ctx.bodyClass} text-slate-600">${escapeHtml(
        plan.description
      )}</p><ul className="mt-4 list-disc pl-6 ${ctx.bodyClass} text-slate-600">${features}</ul><button className="mt-6 ${
        ctx.buttonClassByStyle.primary
      }">${escapeHtml(plan.ctaLabel)}</button></li>`;
    })
    .join("");

  return renderSectionWrapper(
    "section",
    section,
    ctx,
    `<div className="space-y-6"><h2 className="${ctx.h2Class} font-semibold text-slate-900">${escapeHtml(
      pricing.copy.title
    )}</h2><ul className="grid ${ctx.gapClass} md:grid-cols-${String(pricing.props.plans)}">${plans}</ul></div>`
  );
};

const renderFaq: RegistryRenderFn = (section, ctx) => {
  const faq = section as Extract<WebsitePlanSection, { type: "faq" }>;
  const items = faq.copy.items
    .map(
      (item) =>
        `<details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-base font-semibold text-slate-900">${escapeHtml(
          item.q
        )}</summary><p className="mt-3 ${ctx.bodyClass} text-slate-600">${escapeHtml(item.a)}</p></details>`
    )
    .join("");

  return renderSectionWrapper("section", section, ctx, `<div className="space-y-4">${items}</div>`);
};

const renderCtaBanner: RegistryRenderFn = (section, ctx) => {
  const cta = section as Extract<WebsitePlanSection, { type: "cta_banner" }>;

  return renderSectionWrapper(
    "section",
    section,
    ctx,
    `<div className="rounded-2xl border border-slate-200 bg-slate-50 p-8"><h2 className="${ctx.h2Class} font-semibold text-slate-900">${escapeHtml(
      cta.copy.title
    )}</h2><p className="mt-3 ${ctx.bodyClass} text-slate-600">${escapeHtml(
      cta.copy.subtitle
    )}</p><a href="${escapeHtml(cta.ctas[0]?.href ?? "/")}" className="mt-5 inline-flex ${ctx.buttonClassByStyle.primary}">${escapeHtml(
      cta.copy.ctaLabel
    )}</a></div>`
  );
};

const renderContact: RegistryRenderFn = (section, ctx) => {
  const contact = section as Extract<WebsitePlanSection, { type: "contact" }>;

  return renderSectionWrapper(
    "section",
    section,
    ctx,
    `<div className="space-y-4"><h2 className="${ctx.h2Class} font-semibold text-slate-900">${escapeHtml(
      contact.copy.title
    )}</h2><p className="${ctx.bodyClass} text-slate-600">${escapeHtml(
      contact.copy.subtitle
    )}</p><form className="grid ${ctx.gapClass}"><input aria-label="Email" placeholder="Email" className="rounded-lg border border-slate-300 px-4 py-3" /><button type="submit" className="${
      ctx.buttonClassByStyle.primary
    }">${escapeHtml(contact.copy.submitLabel)}</button></form></div>`
  );
};

const renderFooter: RegistryRenderFn = (section, ctx) => {
  const footer = section as Extract<WebsitePlanSection, { type: "footer" }>;
  const columns = footer.copy.columns
    .map((column) => {
      const links = column.links
        .map((link) => `<li><a href="${escapeHtml(link.href)}" className="text-sm text-slate-600">${escapeHtml(link.label)}</a></li>`)
        .join("");
      return `<div><h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(
        column.title
      )}</h3><ul className="mt-3 space-y-2">${links}</ul></div>`;
    })
    .join("");

  return renderSectionWrapper("footer", section, ctx, `<div className="grid ${ctx.gapClass} md:grid-cols-3">${columns}</div>`);
};

export const registry: Record<SectionType, RegistryEntry> = {
  header: { variants: ["simple"], renderFn: renderHeader },
  hero: { variants: ["split", "centered"], renderFn: renderHero },
  logos: { variants: ["grid"], renderFn: renderLogos },
  features: { variants: ["grid3", "grid4"], renderFn: renderFeatures },
  feature_spotlight: { variants: ["alternating"], renderFn: renderFeatureSpotlight },
  metrics: { variants: ["row"], renderFn: renderMetrics },
  testimonials: { variants: ["cards"], renderFn: renderTestimonials },
  pricing: { variants: ["cards"], renderFn: renderPricing },
  faq: { variants: ["accordion"], renderFn: renderFaq },
  cta_banner: { variants: ["simple"], renderFn: renderCtaBanner },
  contact: { variants: ["simple"], renderFn: renderContact },
  footer: { variants: ["simple"], renderFn: renderFooter }
};

export const allowedSectionsByVertical: Record<Vertical, SectionType[]> = {
  restaurant: ["header", "hero", "features", "feature_spotlight", "contact", "testimonials", "pricing", "cta_banner", "footer"],
  clinic: ["header", "hero", "features", "feature_spotlight", "testimonials", "contact", "cta_banner", "footer"],
  barbershop: ["header", "hero", "features", "feature_spotlight", "testimonials", "faq", "contact", "cta_banner", "footer"],
  saas: ["header", "hero", "features", "testimonials", "pricing", "faq", "cta_banner", "footer", "logos", "feature_spotlight"],
  portfolio: ["header", "hero", "features", "feature_spotlight", "testimonials", "contact", "footer"],
  ecommerce: ["header", "hero", "features", "metrics", "testimonials", "cta_banner", "footer"],
  local_business: ["header", "hero", "features", "feature_spotlight", "testimonials", "faq", "contact", "cta_banner", "footer"],
  event: ["header", "hero", "features", "faq", "cta_banner", "footer"],
  blog: ["header", "hero", "features", "cta_banner", "footer"],
  other: ["header", "hero", "features", "faq", "cta_banner", "footer"]
};

export const defaultOrderByVertical: Record<Vertical, SectionType[]> = {
  restaurant: ["header", "hero", "features", "feature_spotlight", "contact", "testimonials", "cta_banner", "footer"],
  clinic: ["header", "hero", "features", "feature_spotlight", "testimonials", "contact", "cta_banner", "footer"],
  barbershop: ["header", "hero", "features", "feature_spotlight", "testimonials", "faq", "contact", "cta_banner", "footer"],
  saas: ["header", "hero", "logos", "features", "feature_spotlight", "testimonials", "pricing", "faq", "cta_banner", "footer"],
  portfolio: ["header", "hero", "features", "feature_spotlight", "testimonials", "contact", "footer"],
  ecommerce: ["header", "hero", "features", "metrics", "testimonials", "cta_banner", "footer"],
  local_business: ["header", "hero", "features", "feature_spotlight", "testimonials", "faq", "contact", "cta_banner", "footer"],
  event: ["header", "hero", "features", "faq", "cta_banner", "footer"],
  blog: ["header", "hero", "features", "cta_banner", "footer"],
  other: ["header", "hero", "features", "faq", "cta_banner", "footer"]
};

export const recommendedOrderBySiteType: Record<SiteType, SectionType[]> = {
  saas: defaultOrderByVertical.saas,
  portfolio: defaultOrderByVertical.portfolio,
  local_business: defaultOrderByVertical.local_business,
  ecommerce: defaultOrderByVertical.ecommerce,
  event: defaultOrderByVertical.event,
  blog: defaultOrderByVertical.blog,
  other: defaultOrderByVertical.other
};

export const PRICING_PROMPT_TOKENS = [
  "pricing",
  "plan",
  "plans",
  "subscription",
  "subscriptions",
  "tiers",
  "online store",
  "membership"
];

export const promptExplicitlyRequestsPricing = (rawPrompt: string) => {
  const lowered = rawPrompt.toLowerCase();
  return PRICING_PROMPT_TOKENS.some((token) => lowered.includes(token));
};

export const promptLikelyContainsRealMetrics = (rawPrompt: string) => {
  const lowered = rawPrompt.toLowerCase();
  return /\b\d+\s?(%|x)\b/.test(lowered) || /\b\d+\s?(customers|users|reviews|years|days|hours|projects)\b/.test(lowered);
};
