import type { SiteDocument, SiteSection, SiteThemeTokens } from "@/lib/website-builder/types";
import type { WebsitePlan, WebsitePlanSection } from "@/src/generation/v0_like/schema";
import { registry, type RegistryRenderContext } from "@/src/generation/v0_like/registry";
import { TOKEN_CLAMPS, pickSpacingTokens } from "@/src/generation/v0_like/tokens";
import type { RenderOutput } from "@/src/generation/v0_like/types";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const selectTokenClampContext = (plan: WebsitePlan): RegistryRenderContext => {
  const spacing = pickSpacingTokens(plan.theme.density);
  const paddingClass = spacing.paddingClass;
  const containerClass = ["saas", "portfolio"].includes(plan.meta.vertical)
    ? TOKEN_CLAMPS.containerWidths[1]
    : TOKEN_CLAMPS.containerWidths[0];

  const h1Class =
    plan.theme.tone === "bold"
      ? TOKEN_CLAMPS.typography.h1[2]
      : plan.theme.tone === "minimal"
        ? TOKEN_CLAMPS.typography.h1[0]
        : TOKEN_CLAMPS.typography.h1[1];

  const h2Class =
    plan.theme.density === "dense"
      ? TOKEN_CLAMPS.typography.h2[0]
      : plan.theme.tone === "premium"
        ? TOKEN_CLAMPS.typography.h2[2]
        : TOKEN_CLAMPS.typography.h2[1];

  const bodyClass = plan.theme.density === "dense" ? TOKEN_CLAMPS.typography.body[0] : TOKEN_CLAMPS.typography.body[1];
  const gapClass = spacing.gapClass;

  const accentUiMap: Record<
    WebsitePlan["theme"]["accent"],
    {
      primary: string;
      secondary: string;
      ghost: string;
      heroSurface: string;
      sectionSurface: string;
      ctaSurface: string;
      headerSurface: string;
      pageSurface: string;
    }
  > = {
    slate: {
      primary: "bg-slate-900 text-white hover:bg-slate-800",
      secondary: "border-slate-300 text-slate-800 hover:border-slate-400",
      ghost: "text-slate-700 hover:bg-slate-100",
      heroSurface: "bg-slate-50",
      sectionSurface: "bg-white",
      ctaSurface: "bg-slate-50",
      headerSurface: "bg-white",
      pageSurface: "bg-slate-50"
    },
    blue: {
      primary: "bg-blue-600 text-white hover:bg-blue-700",
      secondary: "border-blue-200 text-blue-800 hover:border-blue-300",
      ghost: "text-blue-700 hover:bg-blue-50",
      heroSurface: "bg-blue-50",
      sectionSurface: "bg-white",
      ctaSurface: "bg-blue-50",
      headerSurface: "bg-white",
      pageSurface: "bg-blue-50"
    },
    indigo: {
      primary: "bg-indigo-600 text-white hover:bg-indigo-700",
      secondary: "border-indigo-200 text-indigo-800 hover:border-indigo-300",
      ghost: "text-indigo-700 hover:bg-indigo-50",
      heroSurface: "bg-indigo-50",
      sectionSurface: "bg-white",
      ctaSurface: "bg-indigo-50",
      headerSurface: "bg-white",
      pageSurface: "bg-indigo-50"
    },
    violet: {
      primary: "bg-violet-600 text-white hover:bg-violet-700",
      secondary: "border-violet-200 text-violet-800 hover:border-violet-300",
      ghost: "text-violet-700 hover:bg-violet-50",
      heroSurface: "bg-violet-50",
      sectionSurface: "bg-white",
      ctaSurface: "bg-violet-50",
      headerSurface: "bg-white",
      pageSurface: "bg-violet-50"
    },
    cyan: {
      primary: "bg-cyan-600 text-white hover:bg-cyan-700",
      secondary: "border-cyan-200 text-cyan-800 hover:border-cyan-300",
      ghost: "text-cyan-700 hover:bg-cyan-50",
      heroSurface: "bg-cyan-50",
      sectionSurface: "bg-white",
      ctaSurface: "bg-cyan-50",
      headerSurface: "bg-white",
      pageSurface: "bg-cyan-50"
    },
    teal: {
      primary: "bg-teal-600 text-white hover:bg-teal-700",
      secondary: "border-teal-200 text-teal-800 hover:border-teal-300",
      ghost: "text-teal-700 hover:bg-teal-50",
      heroSurface: "bg-teal-50",
      sectionSurface: "bg-white",
      ctaSurface: "bg-teal-50",
      headerSurface: "bg-white",
      pageSurface: "bg-teal-50"
    },
    green: {
      primary: "bg-green-600 text-white hover:bg-green-700",
      secondary: "border-green-200 text-green-800 hover:border-green-300",
      ghost: "text-green-700 hover:bg-green-50",
      heroSurface: "bg-green-50",
      sectionSurface: "bg-white",
      ctaSurface: "bg-green-50",
      headerSurface: "bg-white",
      pageSurface: "bg-green-50"
    },
    orange: {
      primary: "bg-orange-600 text-white hover:bg-orange-700",
      secondary: "border-orange-200 text-orange-800 hover:border-orange-300",
      ghost: "text-orange-700 hover:bg-orange-50",
      heroSurface: "bg-orange-50",
      sectionSurface: "bg-white",
      ctaSurface: "bg-orange-50",
      headerSurface: "bg-white",
      pageSurface: "bg-orange-50"
    },
    red: {
      primary: "bg-red-600 text-white hover:bg-red-700",
      secondary: "border-red-200 text-red-800 hover:border-red-300",
      ghost: "text-red-700 hover:bg-red-50",
      heroSurface: "bg-red-50",
      sectionSurface: "bg-white",
      ctaSurface: "bg-red-50",
      headerSurface: "bg-white",
      pageSurface: "bg-red-50"
    },
    yellow: {
      primary: "bg-yellow-500 text-slate-900 hover:bg-yellow-400",
      secondary: "border-yellow-300 text-yellow-800 hover:border-yellow-400",
      ghost: "text-yellow-800 hover:bg-yellow-50",
      heroSurface: "bg-yellow-50",
      sectionSurface: "bg-white",
      ctaSurface: "bg-yellow-50",
      headerSurface: "bg-white",
      pageSurface: "bg-yellow-50"
    }
  };

  const accentUi = accentUiMap[plan.theme.accent];

  return {
    brandName: plan.meta.brandName,
    paddingClass,
    containerClass,
    h1Class,
    h2Class,
    bodyClass,
    gapClass,
    sectionClassByType: {
      header: accentUi.headerSurface,
      hero: accentUi.heroSurface,
      features: accentUi.sectionSurface,
      feature_spotlight: accentUi.heroSurface,
      testimonials: accentUi.sectionSurface,
      contact: accentUi.sectionSurface,
      cta_banner: accentUi.ctaSurface,
      footer: accentUi.headerSurface
    },
    buttonClassByStyle: {
      primary: `items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold ${accentUi.primary}`,
      secondary: `items-center justify-center rounded-lg border px-5 py-3 text-sm font-semibold ${accentUi.secondary}`,
      ghost: `items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold ${accentUi.ghost}`
    }
  };
};

const countH1InJsx = (jsx: string) => (jsx.match(/<h1\b/g) ?? []).length;

const mediaToLegacyImage = (section: WebsitePlanSection, media: WebsitePlanSection["media"][number], index: number) => {
  let src = media.src;
  if (media.source === "placeholder") {
    const dimensions = media.aspectRatio === "1:1" ? "800x800" : media.aspectRatio === "4:3" ? "1200x900" : "1280x720";
    src = `https://placehold.co/${dimensions}?text=${encodeURIComponent(media.alt)}`;
  }

  return {
    slot: `${section.type}-${index + 1}`,
    src,
    alt: media.alt,
    query: `${section.type}-${media.role}`
  };
};

const sectionToLegacy = (section: WebsitePlanSection): SiteSection | null => {
  const base = {
    id: section.id,
    variant: "A",
    enabled: true,
    style: {
      alignment: "left" as const,
      spacing: "normal" as const,
      background: { type: "plain" as const },
      buttonStyle: "solid" as const,
      colorOverride: null
    },
    images: section.media.map((media, index) => mediaToLegacyImage(section, media, index))
  };

  switch (section.type) {
    case "header":
      return null;
    case "hero":
      return {
        ...base,
        type: "hero",
        variant: section.variant === "split" ? "A" : "C",
        content: {
          headline: section.copy.headline,
          subheadline: section.copy.subheadline,
          ctaLabel: section.copy.primaryCtaLabel,
          ctaHref: section.ctas.find((cta) => cta.intent === "primary")?.href ?? "/contact"
        }
      };
    case "logos":
      return {
        ...base,
        type: "gallery",
        content: {
          title: section.copy.label || "Trusted by teams"
        }
      };
    case "features":
      return {
        ...base,
        type: "services",
        variant: section.variant === "grid4" ? "C" : "A",
        content: {
          title: section.copy.title,
          items: section.copy.items.map((item) => ({ title: item.title, body: item.description }))
        }
      };
    case "feature_spotlight":
      return {
        ...base,
        type: "about",
        content: {
          title: section.copy.items[0]?.title ?? "Highlights",
          body: section.copy.items
            .map((item) => `${item.title}: ${item.description}`)
            .join(" ")
            .slice(0, 250)
        }
      };
    case "metrics":
      return {
        ...base,
        type: "custom",
        content: {
          title: "Key metrics",
          body: section.copy.items.map((item) => `${item.value} ${item.label}`).join(" • ")
        }
      };
    case "testimonials":
      return {
        ...base,
        type: "testimonials",
        content: {
          title: "Testimonials",
          items: section.copy.items.map((item) => ({
            quote: item.quote,
            name: item.name,
            role: item.title
          }))
        }
      };
    case "pricing":
      return {
        ...base,
        type: "pricing",
        content: {
          title: section.copy.title,
          plans: section.copy.plans.map((plan) => ({
            name: plan.name,
            price: plan.price,
            description: plan.description
          }))
        }
      };
    case "faq":
      return {
        ...base,
        type: "faq",
        content: {
          title: "FAQ",
          items: section.copy.items.map((item) => ({ question: item.q, answer: item.a }))
        }
      };
    case "cta_banner":
      return {
        ...base,
        type: "cta",
        content: {
          title: section.copy.title,
          body: section.copy.subtitle,
          ctaLabel: section.copy.ctaLabel,
          ctaHref: section.ctas.find((cta) => cta.intent === "primary")?.href ?? "/contact"
        }
      };
    case "contact":
      return {
        ...base,
        type: "contact",
        content: {
          title: section.copy.title,
          body: section.copy.subtitle,
          ctaLabel: section.copy.submitLabel,
          ctaHref: "/contact"
        }
      };
    case "footer":
      return {
        ...base,
        type: "footer",
        content: {
          text: section.copy.columns
            .flatMap((column) => column.links)
            .map((link) => link.label)
            .join(" • ")
        }
      };
    default:
      return null;
  }
};

const toLegacyTheme = (plan: WebsitePlan): SiteThemeTokens => {
  const accentMap: Record<WebsitePlan["theme"]["accent"], string> = {
    slate: "#334155",
    blue: "#2563EB",
    indigo: "#4F46E5",
    violet: "#7C3AED",
    cyan: "#0891B2",
    teal: "#0D9488",
    green: "#16A34A",
    orange: "#EA580C",
    red: "#DC2626",
    yellow: "#EAB308"
  };

  const surfaceMap: Record<WebsitePlan["theme"]["accent"], { bg: string; secondary: string }> = {
    slate: { bg: "#F8FAFC", secondary: "#E2E8F0" },
    blue: { bg: "#EFF6FF", secondary: "#DBEAFE" },
    indigo: { bg: "#EEF2FF", secondary: "#E0E7FF" },
    violet: { bg: "#F5F3FF", secondary: "#EDE9FE" },
    cyan: { bg: "#ECFEFF", secondary: "#CFFAFE" },
    teal: { bg: "#F0FDFA", secondary: "#CCFBF1" },
    green: { bg: "#F0FDF4", secondary: "#DCFCE7" },
    orange: { bg: "#FFF7ED", secondary: "#FFEDD5" },
    red: { bg: "#FEF2F2", secondary: "#FEE2E2" },
    yellow: { bg: "#FEFCE8", secondary: "#FEF9C3" }
  };

  const surface = surfaceMap[plan.theme.accent];
  const buttonTextMap: Record<WebsitePlan["theme"]["accent"], string> = {
    slate: "#FFFFFF",
    blue: "#FFFFFF",
    indigo: "#FFFFFF",
    violet: "#FFFFFF",
    cyan: "#FFFFFF",
    teal: "#FFFFFF",
    green: "#FFFFFF",
    orange: "#FFFFFF",
    red: "#FFFFFF",
    yellow: "#111827"
  };

  return {
    primary: accentMap[plan.theme.accent],
    secondary: surface.secondary,
    bg: surface.bg,
    text: "#0F172A",
    muted: "#475569",
    surface: "#FFFFFF",
    border: "#E2E8F0",
    buttonText: buttonTextMap[plan.theme.accent],
    accent: accentMap[plan.theme.accent],
    radius: plan.theme.radius === "sm" ? "lg" : "xl",
    fontHeading:
      plan.theme.font === "serif"
        ? '"Merriweather", Georgia, serif'
        : plan.theme.font === "mono"
          ? '"IBM Plex Mono", monospace'
          : '"Inter", system-ui, sans-serif',
    fontBody:
      plan.theme.font === "serif"
        ? '"Merriweather", Georgia, serif'
        : plan.theme.font === "mono"
          ? '"IBM Plex Mono", monospace'
          : '"Inter", system-ui, sans-serif',
    pageTransitions: "fade"
  };
};

const toLegacySiteDocument = (plan: WebsitePlan): SiteDocument => {
  const legacySections = plan.sections
    .map((section) => sectionToLegacy(section))
    .filter((section): section is SiteSection => Boolean(section));

  return {
    templateId: "auto-modern",
    tone: plan.theme.tone,
    theme: toLegacyTheme(plan),
    pages: [
      {
        id: "page-home",
        name: "Home",
        slug: "home",
        order: 0,
        showInMenu: true,
        menuTitle: "Home",
        parentId: null,
        sections: legacySections
      }
    ],
    siteBrief: {
      businessName: plan.meta.brandName,
      logoUrl: plan.meta.logoUrl,
      industry: plan.meta.vertical,
      description: plan.meta.pageDescription,
      tone: plan.theme.tone,
      pages: ["Home"]
    },
    seo: {
      title: plan.meta.pageTitle,
      description: plan.meta.pageDescription
    }
  };
};

export const renderPreviewHtml = (plan: WebsitePlan) => {
  const hero = plan.sections.find(
    (section): section is Extract<WebsitePlanSection, { type: "hero" }> => section.type === "hero"
  );
  const faq = plan.sections.find((section) => section.type === "faq");
  return [
    `<header><nav>${escapeHtml(plan.meta.brandName)}</nav></header>`,
    `<main>`,
    hero ? `<section><h1>${escapeHtml(hero.copy.headline)}</h1><p>${escapeHtml(hero.copy.subheadline)}</p></section>` : "",
    faq ? `<section><h2>FAQ</h2></section>` : "",
    `</main>`,
    `<footer>${escapeHtml(plan.meta.brandName)}</footer>`
  ].join("");
};

export function renderWebsitePlan(plan: WebsitePlan): RenderOutput {
  const clampContext = selectTokenClampContext(plan);
  const fontClass =
    plan.theme.font === "serif" ? "font-serif" : plan.theme.font === "mono" ? "font-mono" : "font-sans";

  const pageSurfaceByAccent: Record<WebsitePlan["theme"]["accent"], string> = {
    slate: "bg-slate-50",
    blue: "bg-blue-50",
    indigo: "bg-indigo-50",
    violet: "bg-violet-50",
    cyan: "bg-cyan-50",
    teal: "bg-teal-50",
    green: "bg-green-50",
    orange: "bg-orange-50",
    red: "bg-red-50",
    yellow: "bg-yellow-50"
  };
  const pageSurfaceClass = pageSurfaceByAccent[plan.theme.accent];

  const sectionJsx = plan.sections.map((section) => {
    const entry = registry[section.type];
    if (!entry) {
      throw new Error(`Unknown section type in registry: ${section.type}`);
    }
    if (!entry.variants.includes(section.variant)) {
      throw new Error(`Invalid variant '${section.variant}' for section '${section.type}'`);
    }
    return entry.renderFn(section, clampContext);
  });

  const body = sectionJsx.join("\n");
  const pageTsx = [
    `import Image from \"next/image\";`,
    "",
    "export default function Page() {",
    "  return (",
    `    <main role=\"main\" className=\"min-h-screen ${pageSurfaceClass} ${fontClass} text-slate-900\">`,
    `      ${body}`,
    "    </main>",
    "  );",
    "}"
  ].join("\n");

  const h1Count = countH1InJsx(pageTsx);
  if (h1Count !== 1) {
    throw new Error(`Rendered output must contain exactly one H1. Found ${h1Count}.`);
  }

  const siteDocument = toLegacySiteDocument(plan);

  return {
    files: [
      {
        path: "app/page.tsx",
        content: pageTsx
      }
    ],
    pageMarkup: body,
    h1Count,
    siteDocument
  };
}
