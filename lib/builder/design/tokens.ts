export const spacingScale = {
  xs: "py-8",
  sm: "py-10",
  md: "py-12",
  lg: "py-14",
  xl: "py-16"
} as const;

export const spacingProfiles = {
  compact: spacingScale.xs,
  normal: spacingScale.md,
  balanced: spacingScale.xl
} as const;

export const radiusScale = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-2xl",
  xl: "rounded-3xl"
} as const;

export const shadowScale = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg"
} as const;

export const typeScale = {
  h1: "text-4xl md:text-5xl",
  h2: "text-2xl md:text-3xl",
  body: "text-base",
  small: "text-sm"
} as const;

export const colorTokens = {
  "service-clean": {
    primary: "#0F172A",
    secondary: "#E2E8F0",
    accent: "#0EA5E9",
    neutral: "#F8FAFC"
  },
  "restaurant-warm": {
    primary: "#7C2D12",
    secondary: "#FDE68A",
    accent: "#B45309",
    neutral: "#FFF7ED"
  },
  "consulting-sharp": {
    primary: "#111827",
    secondary: "#CBD5E1",
    accent: "#2563EB",
    neutral: "#F8FAFC"
  },
  "studio-editorial": {
    primary: "#1F2937",
    secondary: "#E5E7EB",
    accent: "#BE185D",
    neutral: "#FAFAF9"
  },
  "clinic-calm": {
    primary: "#0F8A7A",
    secondary: "#D9E9E1",
    accent: "#0E9F8D",
    neutral: "#EAF3EE"
  },
  "fitness-boost": {
    primary: "#1E1B4B",
    secondary: "#DDD6FE",
    accent: "#7C3AED",
    neutral: "#F5F3FF"
  },
  "legal-trust": {
    primary: "#1F2937",
    secondary: "#E5E7EB",
    accent: "#92400E",
    neutral: "#F9FAFB"
  },
  "home-trades": {
    primary: "#1E3A8A",
    secondary: "#DBEAFE",
    accent: "#2563EB",
    neutral: "#F8FAFC"
  }
} as const;

export type SpacingToken = keyof typeof spacingScale;
export type SpacingProfile = keyof typeof spacingProfiles;
export type RadiusToken = keyof typeof radiusScale;
export type ShadowToken = keyof typeof shadowScale;
export type TypeToken = keyof typeof typeScale;
export type TokenSetId = keyof typeof colorTokens;

export const TOKEN_SET_IDS = Object.keys(colorTokens) as TokenSetId[];
export const SPACING_PROFILE_IDS = Object.keys(spacingProfiles) as SpacingProfile[];
