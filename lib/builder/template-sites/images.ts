import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "v0-sdk";
import { describePalette } from "@/lib/builder/template-sites/palette";
import { normalizeBuilderImageSlot, type BuilderImageSlot } from "@/lib/builder/site-assets";
import { searchPexels, type NormalizedImage } from "@/lib/website-builder/images/pexels";
import type {
  IntegratedTemplateId,
  RestaurantTemplateContent,
  ResolvedTemplateImage,
  TemplateImagePolicy,
  TemplateImageSet
} from "@/lib/builder/template-sites/schema";
import { getThemeStyleOption, type ThemeStyleId } from "@/lib/builder/template-sites/themes";

const V0_MODEL_ID = "v0-pro";
const V0_TIMEOUT_MS = 30_000;
const V0_POLL_INTERVAL_MS = 1_500;
const PREMIUM_V0_TERMS = [
  "premium",
  "luxury",
  "luxurious",
  "dramatic",
  "editorial",
  "cinematic",
  "dark",
  "bold",
  "rooftop",
  "steakhouse",
  "fine dining",
  "tasting menu"
] as const;

const IMAGE_REFRESH_TERMS = [
  "new image",
  "new images",
  "replace image",
  "replace hero image",
  "refresh image",
  "refresh images",
  "new photo",
  "new photos",
  "regenerate image",
  "regenerate hero",
  "change the visuals",
  "change imagery",
  "uploaded business photos",
  "replace placeholder visuals",
  "replace stock visuals"
] as const;

const TEMPLATE_BUDGETS: Record<
  IntegratedTemplateId,
  Pick<TemplateImagePolicy, "maxPexelsImages" | "maxGeneratedImages" | "imageBudgetMode">
> = {
  evasion: { maxPexelsImages: 7, maxGeneratedImages: 1, imageBudgetMode: "premium_hero" },
  essence: { maxPexelsImages: 7, maxGeneratedImages: 1, imageBudgetMode: "premium_hero" },
  hously: { maxPexelsImages: 5, maxGeneratedImages: 0, imageBudgetMode: "lean" },
  "food-truck": { maxPexelsImages: 4, maxGeneratedImages: 0, imageBudgetMode: "lean" }
};

const isRemoteImageUrl = (value?: string | null) =>
  Boolean(value && /^https?:\/\//i.test(value));

const includesAny = (value: string, terms: readonly string[]) =>
  terms.some((term) => value.includes(term));

const NEGATIVE_ALT_TERMS = [
  "superhero",
  "costume",
  "cosplay",
  "mascot",
  "toy",
  "cartoon",
  "wedding",
  "office",
  "laptop",
  "fitness",
  "construction",
  "car",
  "bedroom",
  "living room",
  "super market",
  "grocery",
  "warehouse",
  "helm",
  "sport",
  "comic",
  "festival",
  "face paint",
  "outdoor portrait",
  "street portrait"
] as const;

const HERO_PRIORITY_TERMS = [
  "restaurant",
  "dining",
  "interior",
  "table",
  "chef",
  "dish",
  "plated",
  "cuisine",
  "steak",
  "sushi",
  "brunch",
  "cafe",
  "cocktail",
  "ambiance",
  "fine dining",
  "steakhouse",
  "restaurant interior",
  "tablescape",
  "chef's table",
  "plated food"
] as const;

const HERO_PENALTY_TERMS = [
  "portrait",
  "selfie",
  "model",
  "costume",
  "superhero",
  "cosplay",
  "headshot",
  "festival"
] as const;

const TEMPLATE_IMAGE_HINTS: Record<IntegratedTemplateId, string[]> = {
  evasion: ["steakhouse", "moody dining room", "dramatic plating", "dark bar"],
  essence: ["fine dining", "chef plated dish", "editorial interior", "sommelier"],
  hously: ["modern restaurant", "minimal dining room", "sushi plating", "brunch table"],
  "food-truck": ["casual grill", "burger plate", "comfort food", "open kitchen"]
};

const TEMPLATE_SLOT_TARGETS: Record<
  IntegratedTemplateId,
  { highlights: number; dishes: number; gallery: number }
> = {
  evasion: { highlights: 4, dishes: 4, gallery: 6 },
  essence: { highlights: 3, dishes: 3, gallery: 4 },
  hously: { highlights: 4, dishes: 3, gallery: 4 },
  "food-truck": { highlights: 3, dishes: 4, gallery: 4 }
};

type UploadedSiteImage = {
  url: string;
  alt?: string | null;
  kind?: "hero" | "gallery" | "other" | "logo" | null;
  targetSlot?: BuilderImageSlot | null;
};

const uniqueImages = (images: NormalizedImage[]) => {
  const seen = new Set<string>();
  return images.filter((image) => {
    const key = image.sourceUrl || image.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildHeroQueries = (
  template: IntegratedTemplateId,
  query: string,
  themeStyle?: ThemeStyleId | null,
  paletteDirection?: string | null
) => {
  const theme = getThemeStyleOption(themeStyle);
  const templateHint = TEMPLATE_IMAGE_HINTS[template][0];
  const mood = theme?.imageMood ?? "restaurant interior";
  const qualityDirection =
    template === "evasion" || template === "essence"
      ? "high resolution editorial hospitality photography, sharp focus, cinematic landscape"
      : "high resolution restaurant photography, sharp focus, landscape composition";
  return [
    `${query}, ${mood}, ${qualityDirection}${paletteDirection ? `, ${paletteDirection}` : ""}`,
    `${templateHint}, ${mood}, wide restaurant interior, premium hospitality`,
    `${query}, ${templateHint}, plated dish or restaurant interior`,
    `${query}, restaurant interior, plated dish, landscape photo`
  ];
};

const buildSupportingQueries = (
  template: IntegratedTemplateId,
  query: string,
  themeStyle?: ThemeStyleId | null,
  paletteDirection?: string | null
) => {
  const theme = getThemeStyleOption(themeStyle);
  const templateHint = TEMPLATE_IMAGE_HINTS[template][0];
  const mood = theme?.imageMood ?? "restaurant detail";
  return [
    `${query}, ${mood}, sharp restaurant photography${paletteDirection ? `, ${paletteDirection}` : ""}`,
    `${templateHint}, ${query}, hospitality detail`,
    query
  ];
};

const scorePexelsResult = ({
  image,
  query,
  template,
  themeStyle,
  purpose
}: {
  image: NormalizedImage;
  query: string;
  template: IntegratedTemplateId;
  themeStyle?: ThemeStyleId | null;
  purpose: "hero" | "supporting";
}) => {
  const theme = getThemeStyleOption(themeStyle);
  const alt = `${image.alt} ${image.photographer}`.toLowerCase();
  const queryTerms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

  if (NEGATIVE_ALT_TERMS.some((term) => alt.includes(term))) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  if (image.width >= 1600) score += 8;
  if (image.width >= 2200) score += 8;
  if (purpose === "hero" && image.width < 1400) score -= 20;
  if (purpose === "hero" && image.height < 900) score -= 12;

  const landscape = image.width >= image.height;
  if (purpose === "hero") {
    score += landscape ? 12 : -8;
    const aspect = image.width / Math.max(image.height, 1);
    if (aspect >= 1.35 && aspect <= 2.25) score += 8;
    if (aspect < 1.2 || aspect > 2.5) score -= 8;
  } else if (!landscape) {
    score += 2;
  }

  queryTerms.forEach((term) => {
    if (alt.includes(term)) score += 3;
  });

  TEMPLATE_IMAGE_HINTS[template].forEach((term) => {
    if (alt.includes(term)) score += 4;
  });

  if (theme?.promptHint) {
    theme.promptHint
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3)
      .forEach((term) => {
        if (alt.includes(term)) score += 2;
      });
  }

  if (purpose === "hero") {
    HERO_PRIORITY_TERMS.forEach((term) => {
      if (alt.includes(term)) score += 3;
    });
    HERO_PENALTY_TERMS.forEach((term) => {
      if (alt.includes(term)) score -= 10;
    });
  }

  if ((alt.includes("man") || alt.includes("woman") || alt.includes("person")) && purpose === "hero") {
    const stillRelevant = HERO_PRIORITY_TERMS.some((term) => alt.includes(term));
    if (!stillRelevant) score -= 8;
  }

  if (purpose === "hero") {
    const heroSignals = HERO_PRIORITY_TERMS.filter((term) => alt.includes(term)).length;
    if (heroSignals === 0) score -= 12;
  }

  return score;
};

const choosePexelsImage = async ({
  template,
  query,
  alt,
  purpose,
  themeStyle,
  paletteDirection,
  excludeUrls
}: {
  template: IntegratedTemplateId;
  query: string;
  alt: string;
  purpose: "hero" | "supporting";
  themeStyle?: ThemeStyleId | null;
  paletteDirection?: string | null;
  excludeUrls?: Set<string>;
}) => {
  try {
    const queries =
      purpose === "hero"
        ? buildHeroQueries(template, query, themeStyle, paletteDirection)
        : buildSupportingQueries(template, query, themeStyle, paletteDirection);
    const resultBatches = await Promise.all(
      queries.map((entry) => searchPexels(entry, purpose === "hero" ? 15 : 8).catch(() => []))
    );
    const scored = uniqueImages(resultBatches.flat())
      .filter((image) => !excludeUrls?.has(image.url) && !excludeUrls?.has(image.sourceUrl))
      .map((image) => ({
        image,
        score: scorePexelsResult({
          image,
          query,
          template,
          themeStyle,
          purpose
        })
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => right.score - left.score);

    const bestMatch = scored[0];
    if (!bestMatch) return null;
    const minimumHeroScore =
      template === "evasion" || template === "essence" ? 22 : 16;
    if (purpose === "hero" && bestMatch.score < minimumHeroScore) {
      return null;
    }
    if (purpose === "supporting" && bestMatch.score < 6) {
      return null;
    }

    const match = bestMatch.image;
    if (!match) return null;
    return {
      url: match.url,
      alt: alt || match.alt,
      source: "pexels" as const,
      photographer: match.photographer,
      sourceUrl: match.sourceUrl
    };
  } catch {
    return null;
  }
};

const findLatestImageAttachment = (chat: any): ResolvedTemplateImage | null => {
  const messages = Array.isArray(chat?.messages) ? [...chat.messages].reverse() : [];
  for (const message of messages) {
    if (message?.role !== "assistant") continue;
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const imageAttachment = attachments.find((attachment: any) => {
      const contentType = typeof attachment?.contentType === "string" ? attachment.contentType : "";
      const url = typeof attachment?.url === "string" ? attachment.url : "";
      return contentType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(url);
    });
    if (!imageAttachment?.url) continue;
    return {
      url: imageAttachment.url,
      alt: typeof message.content === "string" && message.content.trim().length > 0 ? message.content.trim() : "Generated restaurant hero image",
      source: "v0"
    };
  }
  return null;
};

const generateV0HeroImage = async (
  query: string,
  alt: string
): Promise<ResolvedTemplateImage | null> => {
  const apiKey = process.env.V0_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const client = createClient({ apiKey });
    let chat: any = await client.chats.create({
      message: [
        "Generate one premium restaurant hero image.",
        "Do not generate code or a website layout.",
        "Return a single image attachment for this brief:",
        query,
        `Desired alt text: ${alt}`
      ].join("\n"),
      chatPrivacy: "private",
      responseMode: "sync",
      modelConfiguration: {
        modelId: V0_MODEL_ID,
        imageGenerations: true,
        thinking: false
      }
    });

    const startedAt = Date.now();
    while (chat?.latestVersion?.status === "pending" && Date.now() - startedAt < V0_TIMEOUT_MS) {
      await sleep(V0_POLL_INTERVAL_MS);
      chat = await client.chats.getById({ chatId: chat.id });
    }

    return findLatestImageAttachment(chat);
  } catch {
    return null;
  }
};

export const shouldRefreshTemplateImages = (prompt: string) =>
  includesAny(prompt.toLowerCase(), IMAGE_REFRESH_TERMS);

const toUploadedResolvedImage = (
  image: UploadedSiteImage,
  fallbackAlt: string
): ResolvedTemplateImage => ({
  url: image.url,
  alt: image.alt?.trim() || fallbackAlt,
  source: "upload"
});

const slotMatches = (
  image: UploadedSiteImage,
  targetSlots: BuilderImageSlot[]
) => targetSlots.includes(normalizeBuilderImageSlot(image.targetSlot, "auto"));

const pickUploadedImage = ({
  candidates,
  used,
  fallbackAlt,
  preferredKinds,
  targetSlots = ["auto"],
  allowAutoFallback = true
}: {
  candidates: UploadedSiteImage[];
  used: Set<string>;
  fallbackAlt: string;
  preferredKinds: Array<UploadedSiteImage["kind"]>;
  targetSlots?: BuilderImageSlot[];
  allowAutoFallback?: boolean;
}) => {
  const availableCandidates = candidates.filter((image) => !used.has(image.url));
  const slotScoped = availableCandidates.filter((image) =>
    slotMatches(image, targetSlots)
  );
  const autoScoped =
    allowAutoFallback
      ? availableCandidates.filter(
          (image) => normalizeBuilderImageSlot(image.targetSlot, "auto") === "auto"
        )
      : [];
  const match =
    slotScoped.find(
      (image) =>
        preferredKinds.includes(image.kind ?? null)
    ) ??
    slotScoped.find(() => true) ??
    (allowAutoFallback
      ? autoScoped.find(
          (image) =>
            preferredKinds.includes(image.kind ?? null)
        ) ??
        autoScoped.find(() => true)
      : null) ??
    null;

  if (!match) return null;
  used.add(match.url);
  return toUploadedResolvedImage(match, fallbackAlt);
};

export const resolveTemplateImagePolicy = (
  template: IntegratedTemplateId,
  prompt: string,
  themeStyle?: ThemeStyleId | null
): TemplateImagePolicy => {
  const normalized = prompt.toLowerCase();
  const budget = TEMPLATE_BUDGETS[template];
  const theme = getThemeStyleOption(themeStyle);
  const allowV0ImageGeneration =
    (template === "evasion" || template === "essence") &&
    (includesAny(normalized, PREMIUM_V0_TERMS) ||
      theme?.id === "dark-premium" ||
      theme?.id === "editorial-elegant");

  return {
    allowPexelsSearch: true,
    allowV0ImageGeneration,
    maxPexelsImages: budget.maxPexelsImages,
    maxGeneratedImages: allowV0ImageGeneration ? budget.maxGeneratedImages : 0,
    imageMode: "pexels_first",
    imageBudgetMode: budget.imageBudgetMode,
    usedV0HeroGeneration: false
  };
};

type ResolveTemplateImagesInput = {
  template: IntegratedTemplateId;
  prompt: string;
  themeStyle?: ThemeStyleId | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  content: RestaurantTemplateContent;
  existingImages?: TemplateImageSet | null;
  uploadedImages?: UploadedSiteImage[];
  forceRefresh?: boolean;
};

export const resolveTemplateImages = async ({
  template,
  prompt,
  themeStyle,
  primaryColor,
  secondaryColor,
  content,
  existingImages,
  uploadedImages = [],
  forceRefresh = false
}: ResolveTemplateImagesInput): Promise<{
  images: TemplateImageSet;
  policy: TemplateImagePolicy;
}> => {
  const policy = resolveTemplateImagePolicy(template, prompt, themeStyle);
  const slotTargets = TEMPLATE_SLOT_TARGETS[template];
  const paletteDirection = describePalette(primaryColor, secondaryColor);
  let remainingPexels = policy.maxPexelsImages;
  let remainingGenerated = policy.maxGeneratedImages;
  const usedImageUrls = new Set<string>();
  const activeUploadedImages = uploadedImages;
  const hasExplicitHeroUpload = activeUploadedImages.some(
    (image) => normalizeBuilderImageSlot(image.targetSlot, "auto") === "hero"
  );
  const hasExplicitStoryUpload = activeUploadedImages.some(
    (image) => normalizeBuilderImageSlot(image.targetSlot, "auto") === "story"
  );
  const hasExplicitMenuUpload = activeUploadedImages.some(
    (image) => normalizeBuilderImageSlot(image.targetSlot, "auto") === "menu"
  );
  const hasExplicitGalleryUpload = activeUploadedImages.some(
    (image) => normalizeBuilderImageSlot(image.targetSlot, "auto") === "gallery"
  );
  const hasExplicitReservationUpload = activeUploadedImages.some(
    (image) => normalizeBuilderImageSlot(image.targetSlot, "auto") === "reservation"
  );
  const nextImages: TemplateImageSet = {
    hero: forceRefresh || hasExplicitHeroUpload ? null : existingImages?.hero ?? null,
    story: forceRefresh || hasExplicitStoryUpload ? null : existingImages?.story ?? null,
    location:
      forceRefresh || hasExplicitGalleryUpload || hasExplicitReservationUpload
        ? null
        : existingImages?.location ?? null,
    highlights:
      forceRefresh || hasExplicitMenuUpload || hasExplicitGalleryUpload
        ? []
        : existingImages?.highlights ?? [],
    dishes: forceRefresh || hasExplicitMenuUpload ? [] : existingImages?.dishes ?? [],
    gallery:
      forceRefresh || hasExplicitGalleryUpload || hasExplicitReservationUpload
        ? []
        : existingImages?.gallery ?? []
  };

  if (hasExplicitHeroUpload) {
    nextImages.hero = pickUploadedImage({
      candidates: activeUploadedImages,
      used: usedImageUrls,
      fallbackAlt: content.imageBriefs.hero.alt,
      preferredKinds: ["hero", "gallery", "other", null],
      targetSlots: ["hero"],
      allowAutoFallback: false
    });
  } else if (!nextImages.hero && activeUploadedImages.length) {
    nextImages.hero = pickUploadedImage({
      candidates: activeUploadedImages,
      used: usedImageUrls,
      fallbackAlt: content.imageBriefs.hero.alt,
      preferredKinds: ["hero", "gallery", "other", null],
      targetSlots: ["hero", "auto"]
    });
  }

  if (hasExplicitStoryUpload) {
    nextImages.story = pickUploadedImage({
      candidates: activeUploadedImages,
      used: usedImageUrls,
      fallbackAlt: content.imageBriefs.story?.alt ?? content.imageBriefs.hero.alt,
      preferredKinds: ["gallery", "other", "hero", null],
      targetSlots: ["story"],
      allowAutoFallback: false
    });
  } else if (!nextImages.story && activeUploadedImages.length) {
    nextImages.story = pickUploadedImage({
      candidates: activeUploadedImages,
      used: usedImageUrls,
      fallbackAlt: content.imageBriefs.story?.alt ?? content.imageBriefs.hero.alt,
      preferredKinds: ["gallery", "other", "hero", null],
      targetSlots: ["story", "gallery", "auto"]
    });
  }

  [nextImages.hero, nextImages.story, nextImages.location, ...nextImages.highlights, ...nextImages.dishes, ...nextImages.gallery]
    .filter((image): image is ResolvedTemplateImage => Boolean(image?.url))
    .forEach((image) => {
      usedImageUrls.add(image.url);
      if (image.sourceUrl) usedImageUrls.add(image.sourceUrl);
    });

  if ((!nextImages.hero || !isRemoteImageUrl(nextImages.hero.url)) && policy.allowV0ImageGeneration && remainingGenerated > 0) {
    const hero = await choosePexelsImage({
      template,
      query: content.imageBriefs.hero.query,
      alt: content.imageBriefs.hero.alt,
      purpose: "hero",
      themeStyle,
      paletteDirection,
      excludeUrls: usedImageUrls
    });
    if (hero) {
      nextImages.hero = hero;
      usedImageUrls.add(hero.url);
      if (hero.sourceUrl) usedImageUrls.add(hero.sourceUrl);
      remainingPexels -= 1;
    } else {
      const generatedHero = await generateV0HeroImage(content.imageBriefs.hero.query, content.imageBriefs.hero.alt);
      if (generatedHero) {
        nextImages.hero = generatedHero;
        usedImageUrls.add(generatedHero.url);
        if (generatedHero.sourceUrl) usedImageUrls.add(generatedHero.sourceUrl);
        remainingGenerated -= 1;
        policy.usedV0HeroGeneration = true;
      }
    }
  } else if (!nextImages.hero && remainingPexels > 0) {
    const hero = await choosePexelsImage({
      template,
      query: content.imageBriefs.hero.query,
      alt: content.imageBriefs.hero.alt,
      purpose: "hero",
      themeStyle,
      paletteDirection,
      excludeUrls: usedImageUrls
    });
    if (hero) {
      nextImages.hero = hero;
      usedImageUrls.add(hero.url);
      if (hero.sourceUrl) usedImageUrls.add(hero.sourceUrl);
      remainingPexels -= 1;
    }
  }

  if (!nextImages.story && content.imageBriefs.story && remainingPexels > 0) {
    const story = await choosePexelsImage({
      template,
      query: content.imageBriefs.story.query,
      alt: content.imageBriefs.story.alt,
      purpose: "supporting",
      themeStyle,
      paletteDirection,
      excludeUrls: usedImageUrls
    });
    if (story) {
      nextImages.story = story;
      usedImageUrls.add(story.url);
      if (story.sourceUrl) usedImageUrls.add(story.sourceUrl);
      remainingPexels -= 1;
    }
  }

  if (!nextImages.location && content.imageBriefs.location && remainingPexels > 0) {
    const uploadedLocation = pickUploadedImage({
      candidates: activeUploadedImages,
      used: usedImageUrls,
      fallbackAlt: content.imageBriefs.location.alt,
      preferredKinds: ["gallery", "other", "hero", null],
      targetSlots: ["gallery", "reservation", "auto"]
    });
    if (uploadedLocation) {
      nextImages.location = uploadedLocation;
    }
  }

  if (!nextImages.location && content.imageBriefs.location && remainingPexels > 0) {
    const location = await choosePexelsImage({
      template,
      query: content.imageBriefs.location.query,
      alt: content.imageBriefs.location.alt,
      purpose: "supporting",
      themeStyle,
      paletteDirection,
      excludeUrls: usedImageUrls
    });
    if (location) {
      nextImages.location = location;
      usedImageUrls.add(location.url);
      if (location.sourceUrl) usedImageUrls.add(location.sourceUrl);
      remainingPexels -= 1;
    }
  }

  while (nextImages.dishes.length < Math.min(slotTargets.dishes, content.imageBriefs.dishes.length)) {
    const brief = content.imageBriefs.dishes[nextImages.dishes.length];
    const uploadedDish = pickUploadedImage({
      candidates: activeUploadedImages,
      used: usedImageUrls,
      fallbackAlt: brief.alt,
      preferredKinds: ["gallery", "hero", "other", null],
      targetSlots: ["menu", "gallery", "auto"]
    });
    if (uploadedDish) {
      nextImages.dishes.push(uploadedDish);
      continue;
    }
    if (remainingPexels <= 0) break;
    const image = await choosePexelsImage({
      template,
      query: brief.query,
      alt: brief.alt,
      purpose: "supporting",
      themeStyle,
      paletteDirection,
      excludeUrls: usedImageUrls
    });
    if (!image) break;
    nextImages.dishes.push(image);
    usedImageUrls.add(image.url);
    if (image.sourceUrl) usedImageUrls.add(image.sourceUrl);
    remainingPexels -= 1;
  }

  while (nextImages.highlights.length < Math.min(slotTargets.highlights, content.imageBriefs.highlights.length)) {
    const brief = content.imageBriefs.highlights[nextImages.highlights.length];
    const uploadedHighlight = pickUploadedImage({
      candidates: activeUploadedImages,
      used: usedImageUrls,
      fallbackAlt: brief.alt,
      preferredKinds: ["gallery", "hero", "other", null],
      targetSlots: ["menu", "story", "gallery", "auto"]
    });
    if (uploadedHighlight) {
      nextImages.highlights.push(uploadedHighlight);
      continue;
    }
    if (remainingPexels <= 0) break;
    const image = await choosePexelsImage({
      template,
      query: brief.query,
      alt: brief.alt,
      purpose: "supporting",
      themeStyle,
      paletteDirection,
      excludeUrls: usedImageUrls
    });
    if (!image) break;
    nextImages.highlights.push(image);
    usedImageUrls.add(image.url);
    if (image.sourceUrl) usedImageUrls.add(image.sourceUrl);
    remainingPexels -= 1;
  }

  while (nextImages.gallery.length < Math.min(slotTargets.gallery, content.imageBriefs.gallery.length)) {
    const brief = content.imageBriefs.gallery[nextImages.gallery.length];
    const uploadedGallery = pickUploadedImage({
      candidates: activeUploadedImages,
      used: usedImageUrls,
      fallbackAlt: brief.alt,
      preferredKinds: ["gallery", "hero", "other", null],
      targetSlots: ["gallery", "reservation", "auto"]
    });
    if (uploadedGallery) {
      nextImages.gallery.push(uploadedGallery);
      continue;
    }
    if (remainingPexels <= 0) break;
    const image = await choosePexelsImage({
      template,
      query: brief.query,
      alt: brief.alt,
      purpose: "supporting",
      themeStyle,
      paletteDirection,
      excludeUrls: usedImageUrls
    });
    if (!image) break;
    nextImages.gallery.push(image);
    usedImageUrls.add(image.url);
    if (image.sourceUrl) usedImageUrls.add(image.sourceUrl);
    remainingPexels -= 1;
  }

  return {
    images: nextImages,
    policy
  };
};
