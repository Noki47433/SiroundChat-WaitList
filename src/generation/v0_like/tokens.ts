import type {
  Density,
  IntakeBrief,
  ThemeAccent,
  ThemeFont,
  ThemeMode,
  Tone
} from "@/src/generation/v0_like/types";

export const TOKEN_CLAMPS = {
  sectionPadding: ["py-12", "py-16", "py-20", "py-24"],
  containerWidths: ["max-w-6xl", "max-w-7xl"],
  typography: {
    h1: ["text-4xl", "text-5xl", "text-6xl"],
    h2: ["text-2xl", "text-3xl", "text-4xl"],
    body: ["text-base", "text-lg"]
  },
  buttonStyles: ["primary", "secondary", "ghost"],
  gaps: ["gap-4", "gap-6", "gap-8", "gap-10", "gap-12"],
  sectionGap: "gap-8",
  maxVerticalPadding: 24
} as const;

export type TokenClampSpec = typeof TOKEN_CLAMPS;

export type ThemeShape = {
  mode: ThemeMode;
  tone: Tone;
  density: Density;
  radius: "sm" | "md" | "lg";
  accent: ThemeAccent;
  font: ThemeFont;
};

export const isRestaurantFontAllowed = (font: ThemeFont) => font === "serif" || font === "sans";

export const enforceThemeLocks = (theme: ThemeShape, intake: IntakeBrief): ThemeShape => {
  const next: ThemeShape = {
    ...theme,
    mode: intake.theme.mode,
    tone: intake.tone,
    density: intake.density,
    accent: intake.locks.accent ? intake.theme.accent : theme.accent,
    font: intake.locks.font ? intake.theme.font : theme.font
  };

  if (intake.vertical === "restaurant" && !isRestaurantFontAllowed(next.font)) {
    next.font = "serif";
  }

  return next;
};

export const pickSpacingTokens = (density: Density) => {
  if (density === "dense") {
    return {
      paddingClass: TOKEN_CLAMPS.sectionPadding[1],
      gapClass: TOKEN_CLAMPS.gaps[1]
    };
  }

  if (density === "airy") {
    return {
      paddingClass: TOKEN_CLAMPS.sectionPadding[3],
      gapClass: TOKEN_CLAMPS.gaps[3]
    };
  }

  return {
    paddingClass: TOKEN_CLAMPS.sectionPadding[2],
    gapClass: TOKEN_CLAMPS.sectionGap
  };
};
