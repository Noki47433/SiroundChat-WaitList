export const BUILDER_IMAGE_SLOT_VALUES = [
  "auto",
  "hero",
  "gallery",
  "story",
  "menu",
  "reservation"
] as const;

export type BuilderImageSlot = (typeof BUILDER_IMAGE_SLOT_VALUES)[number];

export const BUILDER_IMAGE_SLOT_OPTIONS: Array<{
  value: BuilderImageSlot;
  label: string;
  description: string;
}> = [
  { value: "auto", label: "Auto", description: "Let the builder place it." },
  { value: "hero", label: "Hero", description: "First image visitors see." },
  { value: "gallery", label: "Gallery", description: "Atmosphere, food, or interior." },
  { value: "story", label: "About / Story", description: "Team, kitchen, or brand story." },
  { value: "menu", label: "Menu / Dishes", description: "Plating and signature dishes." },
  {
    value: "reservation",
    label: "Reservation",
    description: "Supporting image near reservation prompts."
  }
];

export const isBuilderImageSlot = (value: unknown): value is BuilderImageSlot =>
  typeof value === "string" &&
  (BUILDER_IMAGE_SLOT_VALUES as readonly string[]).includes(value);

export const normalizeBuilderImageSlot = (
  value: unknown,
  fallback: BuilderImageSlot = "auto"
): BuilderImageSlot => (isBuilderImageSlot(value) ? value : fallback);

export const resolveAssetKindFromSlot = (slot: BuilderImageSlot) =>
  slot === "hero" ? "hero" : "gallery";

const SLOT_QUERY_PARAM = "sc_slot";

export const applyBuilderImageSlotToUrl = (url: string, slot: BuilderImageSlot) => {
  try {
    const parsed = new URL(url);
    if (slot === "auto") {
      parsed.searchParams.delete(SLOT_QUERY_PARAM);
    } else {
      parsed.searchParams.set(SLOT_QUERY_PARAM, slot);
    }
    return parsed.toString();
  } catch {
    return url;
  }
};

export const extractBuilderImageSlotFromUrl = (
  url?: string | null,
  fallback: BuilderImageSlot = "auto"
): BuilderImageSlot => {
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    return normalizeBuilderImageSlot(parsed.searchParams.get(SLOT_QUERY_PARAM), fallback);
  } catch {
    return fallback;
  }
};

export const inferBuilderImageSlot = ({
  targetSlot,
  kind,
  url,
  fallback = "auto"
}: {
  targetSlot?: unknown;
  kind?: string | null;
  url?: string | null;
  fallback?: BuilderImageSlot;
}): BuilderImageSlot => {
  if (isBuilderImageSlot(targetSlot)) return targetSlot;
  const kindFallback =
    kind === "hero" ? "hero" : kind === "gallery" ? "gallery" : fallback;
  return extractBuilderImageSlotFromUrl(url, kindFallback);
};

export const isMissingBuilderAssetSlotColumnError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === "42703" ||
    (typeof candidate.message === "string" &&
      candidate.message.toLowerCase().includes("target_slot"))
  );
};
