export type SiteFontOption = {
  id: string;
  label: string;
  legacyValues: string[];
  themeValue: string;
  heading: string;
  body: string;
};

const SANS_FALLBACK = "system-ui, sans-serif";
const SERIF_FALLBACK = "Georgia, serif";

export const SITE_FONT_OPTIONS: SiteFontOption[] = [
  {
    id: "sora",
    label: "Sora",
    legacyValues: ["Sora, Inter, system-ui, sans-serif"],
    themeValue: "var(--font-sora), var(--font-inter), system-ui, sans-serif",
    heading: "var(--font-sora), var(--font-inter), system-ui, sans-serif",
    body: "var(--font-inter), system-ui, sans-serif"
  },
  {
    id: "manrope",
    label: "Manrope",
    legacyValues: ["Manrope, Inter, system-ui, sans-serif"],
    themeValue: "var(--font-manrope), var(--font-inter), system-ui, sans-serif",
    heading: "var(--font-manrope), var(--font-inter), system-ui, sans-serif",
    body: "var(--font-inter), system-ui, sans-serif"
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    legacyValues: ['"Space Grotesk", Inter, system-ui, sans-serif'],
    themeValue: "var(--font-space-grotesk), var(--font-inter), system-ui, sans-serif",
    heading: "var(--font-space-grotesk), var(--font-inter), system-ui, sans-serif",
    body: "var(--font-inter), system-ui, sans-serif"
  },
  {
    id: "playfair",
    label: "Playfair Display",
    legacyValues: ['"Playfair Display", Inter, system-ui, sans-serif'],
    themeValue: "var(--font-playfair), var(--font-inter), Georgia, serif",
    heading: "var(--font-playfair), Georgia, serif",
    body: "var(--font-inter), system-ui, sans-serif"
  },
  {
    id: "jakarta",
    label: "Plus Jakarta Sans",
    legacyValues: ["Plus Jakarta Sans, Inter, system-ui, sans-serif"],
    themeValue: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif",
    heading: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif",
    body: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif"
  },
  {
    id: "cormorant",
    label: "Cormorant Garamond",
    legacyValues: ["Cormorant Garamond, Manrope, Georgia, serif"],
    themeValue: "var(--font-cormorant), var(--font-manrope), Georgia, serif",
    heading: "var(--font-cormorant), Georgia, serif",
    body: "var(--font-manrope), system-ui, sans-serif"
  }
];

export const DEFAULT_SITE_FONT = SITE_FONT_OPTIONS[0];

const normalize = (value?: string | null) => (value ?? "").replace(/"/g, "").trim().toLowerCase();

export const findSiteFontOption = (value?: string | null) => {
  const normalized = normalize(value);
  if (!normalized) return DEFAULT_SITE_FONT;

  return (
    SITE_FONT_OPTIONS.find((option) => {
      if (normalize(option.id) === normalized) return true;
      if (normalize(option.label) === normalized) return true;
      if (normalize(option.themeValue) === normalized) return true;
      if (normalize(option.heading) === normalized) return true;
      if (normalize(option.body) === normalized) return true;
      return option.legacyValues.some((legacy) => normalize(legacy) === normalized);
    }) ?? DEFAULT_SITE_FONT
  );
};

export const getThemeFontValue = (value?: string | null) => findSiteFontOption(value).themeValue;

export const getThemeFontLabel = (value?: string | null) => findSiteFontOption(value).label;

export const getManualFontValue = (value?: string | null) => {
  const option = findSiteFontOption(value);
  return option.heading.includes("serif") ? option.heading : option.themeValue;
};

export const normalizeManualFontValue = (value?: string | null) => {
  if (!value) return "";
  const normalized = normalize(value);
  const match = SITE_FONT_OPTIONS.find(
    (option) =>
      normalize(option.heading) === normalized ||
      normalize(option.body) === normalized ||
      normalize(option.themeValue) === normalized ||
      option.legacyValues.some((legacy) => normalize(legacy) === normalized)
  );
  return match ? getManualFontValue(match.themeValue) : value;
};

export const resolveThemeFontPair = (value?: string | null) => {
  const option = findSiteFontOption(value);
  return {
    label: option.label,
    value: option.themeValue,
    heading: option.heading || `var(--font-inter), ${SANS_FALLBACK}`,
    body: option.body || `var(--font-inter), ${SANS_FALLBACK}`,
    fallbackHeading: option.heading || SERIF_FALLBACK,
    fallbackBody: option.body || SANS_FALLBACK
  };
};
