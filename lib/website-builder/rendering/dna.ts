import { BRAND_ARCHETYPES } from "@/lib/builder/generation/v2/archetypes";
import { LAYOUT_DNA_REGISTRY } from "@/lib/builder/generation/v2/layout-dna";
import type { LayoutDNA, SupportedIndustryKey } from "@/lib/builder/generation/v2/types";
import type { SiteDocument, SiteSection } from "@/lib/website-builder/types";
import { cn } from "@/lib/utils/cn";

export type SectionShellSpec = {
  sectionClassName?: string;
  containerClassName?: string;
};

export type SiteRenderDNA = {
  industryKey?: SupportedIndustryKey;
  archetypeKey?: string;
  layoutId?: string;
  archetypeLabel?: string;
  layout?: LayoutDNA;
  isHighContrast: boolean;
  chrome: {
    headerClassName: string;
    containerClassName: string;
    navClassName: string;
    brandClassName: string;
    badgeClassName: string;
  };
};

const TEMPLATE_INDUSTRY_FALLBACK: Record<string, SupportedIndustryKey | undefined> = {
  "barbershop-editorial": "barbershop",
  "restaurant-editorial": "restaurant",
  "dental-assurance": "dental_clinic",
  "real-estate-signature": "real_estate"
};

const SECTION_WIDTHS: Record<string, { default: string; overrides?: Partial<Record<SiteSection["type"], string>> }> = {
  split_showcase: {
    default: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8",
    overrides: {
      hero: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8",
      gallery: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8",
      cta: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8",
      footer: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8"
    }
  },
  editorial_stack: {
    default: "mx-auto w-full min-w-0 max-w-5xl px-6 lg:px-8",
    overrides: {
      hero: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-10",
      gallery: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-10",
      pricing: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8",
      cta: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8",
      footer: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8"
    }
  },
  immersive_stack: {
    default: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8",
    overrides: {
      hero: "mx-auto w-full min-w-0 max-w-none px-0",
      gallery: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8",
      pricing: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8",
      cta: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8",
      footer: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8"
    }
  },
  centered_story: {
    default: "mx-auto w-full min-w-0 max-w-5xl px-6 lg:px-8",
    overrides: {
      hero: "mx-auto w-full min-w-0 max-w-4xl px-6 lg:px-8",
      reservation: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8",
      contact: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8",
      footer: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8"
    }
  },
  conversion_grid: {
    default: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8",
    overrides: {
      hero: "mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8",
      services: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8",
      pricing: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8",
      contact: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8",
      footer: "mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8"
    }
  }
};

const headerByIndustry = (industryKey?: SupportedIndustryKey) => {
  switch (industryKey) {
    case "barbershop":
      return {
        headerClassName: "border-b border-[color:var(--site-border)] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(17,17,17,0.84))] text-white",
        containerClassName: "mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-4 px-6 py-4 md:grid-cols-[auto_1fr_auto] lg:px-8",
        navClassName: "flex flex-wrap items-center justify-start gap-5 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/62 md:justify-center",
        brandClassName: "inline-flex justify-self-start text-left text-[1.7rem] font-semibold leading-none text-white",
        badgeClassName: "border border-white/15 bg-white/5 text-white/74"
      };
    case "restaurant":
      return {
        headerClassName: "border-b border-[color:var(--site-border)] bg-[color:var(--site-surface)]/95 backdrop-blur-xl",
        containerClassName: "mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-4 px-6 py-5 md:grid-cols-[auto_1fr_auto] lg:px-10",
        navClassName: "flex flex-wrap items-center justify-start gap-5 text-[12px] font-medium uppercase tracking-[0.18em] text-[color:var(--site-muted)] md:justify-center",
        brandClassName: "inline-flex justify-self-start text-left text-[1.8rem] font-semibold leading-none text-[color:var(--site-text)]",
        badgeClassName: "border border-[color:var(--site-border)] bg-[color:var(--site-surface)] text-[color:var(--site-muted)]"
      };
    case "dental_clinic":
      return {
        headerClassName: "border-b border-[color:var(--site-border)] bg-white/88 backdrop-blur-xl",
        containerClassName: "mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-4 px-6 py-4 md:grid-cols-[auto_1fr_auto] lg:px-8",
        navClassName: "flex flex-wrap items-center justify-start gap-4 text-[12px] font-medium text-[color:var(--site-muted)] md:justify-center",
        brandClassName: "inline-flex justify-self-start text-left text-[1.65rem] font-semibold leading-none text-[color:var(--site-text)]",
        badgeClassName: "border border-[color:var(--site-border)] bg-white text-[color:var(--site-muted)]"
      };
    case "real_estate":
      return {
        headerClassName: "border-b border-[color:var(--site-border)] bg-[linear-gradient(180deg,rgba(255,253,249,0.94),rgba(255,253,249,0.9))] backdrop-blur-xl",
        containerClassName: "mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-4 px-6 py-5 md:grid-cols-[auto_1fr_auto] lg:px-10",
        navClassName: "flex flex-wrap items-center justify-start gap-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--site-muted)] md:justify-center",
        brandClassName: "inline-flex justify-self-start text-left text-[1.8rem] font-semibold leading-none text-[color:var(--site-text)]",
        badgeClassName: "border border-[rgba(185,151,91,0.28)] bg-white/80 text-[color:var(--site-muted)]"
      };
    default:
      return {
        headerClassName: "border-b border-[color:var(--site-border)] bg-[color:var(--site-surface)]",
        containerClassName: "mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-4 px-6 py-4 md:grid-cols-[auto_1fr_auto]",
        navClassName: "flex flex-wrap items-center justify-start gap-4 text-sm font-medium text-[color:var(--site-muted)] md:justify-center",
        brandClassName: "inline-flex justify-self-start text-left text-[1.6rem] font-semibold leading-none text-[color:var(--site-text)]",
        badgeClassName: "border border-[color:var(--site-border)] bg-[color:var(--site-surface)] text-[color:var(--site-muted)]"
      };
  }
};

export const resolveSiteRenderDNA = (site: SiteDocument): SiteRenderDNA => {
  const industryKey =
    (site.siteBrief?.designDNA?.industryKey as SupportedIndustryKey | undefined) ??
    TEMPLATE_INDUSTRY_FALLBACK[site.templateId];
  const archetypeKey = site.siteBrief?.designDNA?.archetypeKey;
  const layoutId = site.siteBrief?.designDNA?.layoutDNA;
  const archetype = BRAND_ARCHETYPES.find((entry) => entry.id === archetypeKey);
  const layout = LAYOUT_DNA_REGISTRY.find((entry) => entry.id === layoutId);

  return {
    industryKey,
    archetypeKey,
    layoutId,
    archetypeLabel: archetype?.label,
    layout,
    isHighContrast: archetype?.contrast === "high",
    chrome: headerByIndustry(industryKey)
  };
};

export const resolveSectionShell = (site: SiteDocument, section: SiteSection, spec?: SectionShellSpec): SectionShellSpec => {
  const dna = resolveSiteRenderDNA(site);
  const layoutId = dna.layoutId ?? "split_showcase";
  const widths = SECTION_WIDTHS[layoutId] ?? SECTION_WIDTHS.split_showcase;
  const containerClassName = widths.overrides?.[section.type] ?? widths.default;

  return {
    sectionClassName: cn(spec?.sectionClassName),
    containerClassName: cn(containerClassName, spec?.containerClassName)
  };
};

export const renderSurfaceClass = (
  site: SiteDocument,
  tone: "default" | "feature" | "contrast" | "quiet" | "glass" = "default"
) => {
  const dna = resolveSiteRenderDNA(site);

  switch (dna.archetypeKey) {
    case "bold_urban":
      return tone === "feature"
        ? "rounded-[2rem] border border-white/10 bg-[#111111] text-white shadow-[0_28px_80px_rgba(0,0,0,0.34)]"
        : tone === "glass"
          ? "rounded-[2rem] border border-white/12 bg-white/5 text-white backdrop-blur-xl shadow-[0_26px_70px_rgba(0,0,0,0.25)]"
          : "rounded-[1.7rem] border border-[color:var(--site-border)] bg-[color:var(--site-surface)] shadow-[0_24px_65px_rgba(17,17,17,0.08)]";
    case "classic_gentleman":
      return tone === "feature"
        ? "rounded-[1.8rem] border border-[rgba(197,157,95,0.28)] bg-[color:var(--site-surface)] shadow-[0_24px_60px_rgba(107,78,43,0.12)]"
        : "rounded-[1.5rem] border border-[color:var(--site-border)] bg-[color:var(--site-surface)] shadow-[0_18px_48px_rgba(44,36,30,0.08)]";
    case "premium_fine_dining":
      if (tone === "glass") {
        return "rounded-[2rem] border border-[rgba(201,168,106,0.18)] bg-[rgba(24,19,17,0.78)] text-[#F6EEE3] backdrop-blur-xl shadow-[0_28px_90px_rgba(24,19,17,0.28)]";
      }
      return tone === "feature" || tone === "contrast"
        ? "rounded-[2rem] border border-[rgba(201,168,106,0.24)] bg-[#181311] text-[#F6EEE3] shadow-[0_30px_90px_rgba(24,19,17,0.34)]"
        : "rounded-[1.7rem] border border-[rgba(201,168,106,0.16)] bg-[color:var(--site-surface)] shadow-[0_24px_60px_rgba(24,19,17,0.08)]";
    case "cozy_family_dining":
      if (tone === "glass") {
        return "rounded-[2rem] border border-[rgba(217,119,6,0.12)] bg-[rgba(255,245,232,0.92)] text-[color:var(--site-text)] backdrop-blur-xl shadow-[0_22px_60px_rgba(124,45,18,0.14)]";
      }
      return tone === "feature"
        ? "rounded-[2rem] border border-[rgba(217,119,6,0.18)] bg-[#FFF5E8] shadow-[0_22px_60px_rgba(124,45,18,0.1)]"
        : "rounded-[1.7rem] border border-[color:var(--site-border)] bg-[color:var(--site-surface)] shadow-[0_18px_50px_rgba(124,45,18,0.08)]";
    case "calm_family_care":
      return tone === "feature"
        ? "rounded-[2rem] border border-[rgba(20,184,166,0.2)] bg-white shadow-[0_28px_80px_rgba(15,118,110,0.1)]"
        : "rounded-[1.7rem] border border-[color:var(--site-border)] bg-white shadow-[0_18px_50px_rgba(15,118,110,0.08)]";
    case "modern_clinical_precision":
      return tone === "feature"
        ? "rounded-[1.7rem] border border-[rgba(37,99,235,0.18)] bg-white shadow-[0_28px_70px_rgba(37,99,235,0.08)]"
        : "rounded-[1.35rem] border border-[color:var(--site-border)] bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]";
    case "luxury_property_advisory":
      return tone === "feature" || tone === "contrast"
        ? "rounded-[2rem] border border-[rgba(185,151,91,0.24)] bg-[#141414] text-[#F7EFE4] shadow-[0_28px_90px_rgba(20,20,20,0.28)]"
        : "rounded-[1.7rem] border border-[rgba(185,151,91,0.16)] bg-white shadow-[0_20px_55px_rgba(20,20,20,0.1)]";
    case "local_trusted_agency":
      return tone === "feature"
        ? "rounded-[1.7rem] border border-[rgba(192,132,26,0.18)] bg-white shadow-[0_22px_60px_rgba(31,41,55,0.09)]"
        : "rounded-[1.4rem] border border-[color:var(--site-border)] bg-white shadow-[0_16px_45px_rgba(31,41,55,0.06)]";
    default:
      return tone === "feature"
        ? "rounded-[1.75rem] border border-[color:var(--site-border)] bg-[color:var(--site-surface)] shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
        : "rounded-[1.5rem] border border-[color:var(--site-border)] bg-[color:var(--site-surface)] shadow-[0_18px_48px_rgba(15,23,42,0.06)]";
  }
};

export const renderButtonClass = (
  site: SiteDocument,
  buttonStyle: SiteSection["style"]["buttonStyle"],
  tone: "primary" | "secondary" = "primary"
) => {
  const dna = resolveSiteRenderDNA(site);
  const base = "inline-flex items-center justify-center font-semibold transition duration-200";

  if (dna.archetypeKey === "bold_urban") {
    return cn(
      base,
      tone === "primary"
        ? "rounded-full px-5 py-3 text-sm uppercase tracking-[0.16em]"
        : "rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em]",
      buttonStyle === "outline"
        ? "border border-[color:var(--site-secondary)] text-[color:var(--site-secondary)] hover:bg-[color:var(--site-secondary)] hover:text-[#111111]"
        : "bg-[color:var(--site-secondary)] text-[#111111] hover:opacity-90"
    );
  }

  if (dna.archetypeKey === "premium_fine_dining" || dna.archetypeKey === "luxury_property_advisory") {
    return cn(
      base,
      "rounded-full px-5 py-3 text-sm uppercase tracking-[0.18em]",
      buttonStyle === "outline"
        ? "border border-[color:var(--site-secondary)] text-[color:var(--site-secondary)] hover:bg-[color:var(--site-secondary)] hover:text-[#141414]"
        : "bg-[color:var(--site-primary)] text-[color:var(--site-buttonText)] hover:opacity-90"
    );
  }

  if (dna.archetypeKey === "modern_clinical_precision" || dna.archetypeKey === "local_trusted_agency") {
    return cn(
      base,
      "rounded-[1rem] px-5 py-3 text-sm",
      buttonStyle === "outline"
        ? "border border-[color:var(--site-primary)] text-[color:var(--site-primary)] hover:bg-[color:var(--site-primary)] hover:text-[color:var(--site-buttonText)]"
        : "bg-[color:var(--site-primary)] text-[color:var(--site-buttonText)] hover:opacity-95"
    );
  }

  return cn(
    base,
    "rounded-full px-5 py-3 text-sm",
    buttonStyle === "outline"
      ? "border border-[color:var(--site-primary)] text-[color:var(--site-primary)] hover:bg-[color:var(--site-primary)] hover:text-[color:var(--site-buttonText)]"
      : "bg-[color:var(--site-primary)] text-[color:var(--site-buttonText)] hover:opacity-95"
  );
};

export const renderEyebrowClass = (site: SiteDocument, tone: "default" | "inverse" = "default") => {
  const dna = resolveSiteRenderDNA(site);
  const inverse = tone === "inverse";

  if (dna.industryKey === "barbershop") {
    return cn(
      "text-[11px] font-semibold uppercase tracking-[0.28em]",
      inverse ? "text-white/64" : "text-[color:var(--site-muted)]"
    );
  }

  if (dna.industryKey === "restaurant") {
    return cn(
      "text-[11px] uppercase tracking-[0.24em]",
      inverse ? "text-white/68" : "text-[color:var(--site-muted)]"
    );
  }

  if (dna.industryKey === "dental_clinic") {
    return cn(
      "text-[11px] font-medium uppercase tracking-[0.22em]",
      inverse ? "text-white/72" : "text-[color:var(--site-muted)]"
    );
  }

  return cn(
    "text-[11px] font-semibold uppercase tracking-[0.24em]",
    inverse ? "text-white/70" : "text-[color:var(--site-muted)]"
  );
};

export const renderImageClass = (site: SiteDocument, tone: "hero" | "gallery" | "card" = "card") => {
  const dna = resolveSiteRenderDNA(site);
  if (dna.archetypeKey === "bold_urban") {
    return tone === "hero"
      ? "h-full w-full rounded-[2rem] object-cover saturate-[1.05] contrast-[1.05]"
      : "h-full w-full rounded-[1.6rem] object-cover saturate-[1.04] contrast-[1.04]";
  }
  if (dna.archetypeKey === "premium_fine_dining" || dna.archetypeKey === "luxury_property_advisory") {
    return tone === "hero"
      ? "h-full w-full rounded-[2rem] object-cover contrast-[1.02] brightness-[0.98]"
      : "h-full w-full rounded-[1.7rem] object-cover contrast-[1.02] brightness-[0.98]";
  }
  if (dna.archetypeKey === "modern_clinical_precision" || dna.archetypeKey === "local_trusted_agency") {
    return "h-full w-full rounded-[1.35rem] object-cover";
  }
  return tone === "hero" ? "h-full w-full rounded-[2rem] object-cover" : "h-full w-full rounded-[1.6rem] object-cover";
};

export const renderMetricClass = (site: SiteDocument) => {
  const dna = resolveSiteRenderDNA(site);
  if (dna.industryKey === "barbershop") return "text-3xl font-semibold text-[color:var(--site-secondary)]";
  if (dna.industryKey === "restaurant") return "text-3xl font-semibold text-[color:var(--site-primary)]";
  if (dna.industryKey === "dental_clinic") return "text-3xl font-semibold text-[color:var(--site-primary)]";
  return "text-3xl font-semibold text-[color:var(--site-primary)]";
};
