export const THEME_STYLE_OPTIONS = [
  {
    id: "dark-premium",
    label: "Dark / Premium",
    description: "Moody, upscale, dramatic hospitality.",
    tone: "premium",
    promptHint: "dark, premium, moody, dramatic, upscale restaurant presentation",
    contentDirection: "Use darker, more confident, more premium restaurant language.",
    imageMood: "moody premium restaurant interior or plated dish"
  },
  {
    id: "editorial-elegant",
    label: "Editorial / Elegant",
    description: "Refined, chef-led, polished fine dining.",
    tone: "elegant",
    promptHint: "editorial, elegant, refined, chef-led, polished fine dining",
    contentDirection: "Use refined, elegant, editorial restaurant language.",
    imageMood: "elegant editorial restaurant interior or chef-plated dish"
  },
  {
    id: "modern-minimal",
    label: "Modern / Minimal",
    description: "Clean, restrained, contemporary dining.",
    tone: "minimal",
    promptHint: "modern, minimal, clean, contemporary, restrained restaurant design",
    contentDirection: "Use clean, restrained, contemporary restaurant language.",
    imageMood: "modern minimal restaurant interior or contemporary plated dish"
  },
  {
    id: "warm-cozy",
    label: "Warm / Cozy",
    description: "Inviting, neighborhood, comfortable dining.",
    tone: "friendly",
    promptHint: "warm, cozy, inviting, neighborhood restaurant atmosphere",
    contentDirection: "Use warm, welcoming, comfortable restaurant language.",
    imageMood: "warm cozy restaurant interior or comforting plated meal"
  }
] as const;

export type ThemeStyleId = (typeof THEME_STYLE_OPTIONS)[number]["id"];

export const THEME_STYLE_IDS = THEME_STYLE_OPTIONS.map((option) => option.id) as [
  ThemeStyleId,
  ...ThemeStyleId[]
];

export const DEFAULT_THEME_STYLE: ThemeStyleId = "modern-minimal";

export const getThemeStyleOption = (value?: string | null) =>
  THEME_STYLE_OPTIONS.find((option) => option.id === value) ?? null;
