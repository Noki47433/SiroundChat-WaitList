import { evasionData, type EvasionTemplateData } from "@/components/templates/evasion/data";
import { essenceData, type EssenceTemplateData } from "@/components/templates/essence/data";
import { houslyData, type HouslyTemplateData } from "@/components/templates/hously/data";
import { foodTruckData, type FoodTruckCategory, type FoodTruckMenuItem } from "@/components/templates/food-truck/data";
import type {
  FoodTruckTemplateData,
  IntegratedTemplateData,
  IntegratedTemplateId,
  RestaurantTemplateContent,
  ResolvedTemplateImage,
  TemplateImageSet
} from "@/lib/builder/template-sites/schema";

const imageUrl = (resolved: ResolvedTemplateImage | null | undefined, fallback: string) =>
  resolved?.url ?? fallback;

const media = (
  resolved: ResolvedTemplateImage | null | undefined,
  fallback: { src: string; alt: string }
) => ({
  src: imageUrl(resolved, fallback.src),
  alt: resolved?.alt ?? fallback.alt
});

const uniqueResolvedImages = (
  images: Array<ResolvedTemplateImage | null | undefined>
) => {
  const seen = new Set<string>();
  return images.filter((image): image is ResolvedTemplateImage => {
    if (!image?.url || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
};

const buildImagePool = (images: TemplateImageSet) =>
  uniqueResolvedImages([
    images.hero,
    images.story,
    images.location,
    ...images.highlights,
    ...images.dishes,
    ...images.gallery
  ]);

const imageFromPool = (
  pool: ResolvedTemplateImage[],
  index: number
) => {
  if (!pool.length) return null;
  return pool[index % pool.length] ?? null;
};

const socialLinks = (href: string) => [{ label: "Instagram", href }];

const defaultFooterLinks = (
  links: Array<{ label: string; href: string }>,
  fallback: Array<{ label: string; href: string }>
) => (links.length ? links : fallback);

const normalizeWhitespace = (value?: string | null) =>
  (value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const clampChars = (value: string | undefined | null, max: number, fallback = "") => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return fallback;
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}…`;
};

const clampWords = (
  value: string | undefined | null,
  maxWords: number,
  maxChars: number,
  fallback = ""
) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return fallback;
  const compact = normalized.split(" ").slice(0, maxWords).join(" ");
  return clampChars(compact, maxChars, fallback);
};

const safeWordmark = (value: string | undefined | null, fallback: string) =>
  clampChars(
    normalizeWhitespace(value).replace(/[^a-z0-9]/gi, "").toUpperCase(),
    10,
    fallback
  );

const safePrice = (value: string | undefined | null, fallback: string) =>
  clampChars(value, 8, fallback);

const safeLabel = (value: string | undefined | null, fallback: string, max = 18) =>
  clampWords(value, 3, max, fallback);

type BrandingInput = {
  logoUrl?: string | null;
};

const mapEvasionTemplate = (
  content: RestaurantTemplateContent,
  images: TemplateImageSet,
  branding?: BrandingInput
): EvasionTemplateData => {
  const imagePool = buildImagePool(images);
  const sidePool = uniqueResolvedImages([
    images.story,
    ...images.gallery,
    ...images.highlights,
    ...images.dishes,
    images.hero,
    ...imagePool
  ]);
  const productPool = uniqueResolvedImages([
    ...images.dishes,
    ...images.highlights,
    images.story,
    images.hero,
    ...images.gallery,
    ...imagePool
  ]);
  const galleryPool = uniqueResolvedImages([
    ...images.gallery,
    ...images.highlights,
    ...images.dishes,
    images.story,
    images.hero,
    ...imagePool
  ]);
  const sideImages = evasionData.hero.sideImages.map((entry, index) => ({
    ...entry,
    src: imageFromPool(sidePool, index)?.url ?? entry.src,
    alt: imageFromPool(sidePool, index)?.alt ?? entry.alt
  }));
  const highlightItems = content.highlights.items.slice(0, 6);
  const storyParagraphs = content.story.paragraphs.slice(0, 3);
  const experienceItems = content.experience.items.slice(0, 4);
  const technologyTitle = clampWords(
    content.experience.heading,
    4,
    34,
    evasionData.technology.titleWords.join(" ")
  )
    .split(" ")
    .slice(0, 3);

  return {
    ...evasionData,
    brand: safeWordmark(content.business.shortWordmark, evasionData.brand),
    logoUrl: branding?.logoUrl ?? null,
    header: {
      ...evasionData.header,
      navItems: [
        { label: "Story", href: "#story" },
        { label: "Highlights", href: "#products" },
        { label: "Gallery", href: "#gallery" },
        { label: "Reserve", href: "#reserve" }
      ],
      ctaLabel: clampWords(content.reservation.primaryLabel, 3, 16, evasionData.header.ctaLabel),
      ctaHref: content.reservation.primaryHref
    },
    hero: {
      ...evasionData.hero,
      word: safeWordmark(content.business.shortWordmark, evasionData.hero.word),
      mainImage: media(images.hero, evasionData.hero.mainImage),
      sideImages,
      tagline: clampChars(content.hero.subheadline, 164, evasionData.hero.tagline),
      supportingLines: [
        clampChars(content.story.description, 136, ""),
        clampChars(content.reservation.description, 136, "")
      ].filter(Boolean)
    },
    philosophy: {
      ...evasionData.philosophy,
      heading: clampWords(content.story.heading, 6, 44, evasionData.philosophy.heading),
      description: clampChars(content.story.description, 220, evasionData.philosophy.description),
      paragraphs: storyParagraphs.map((paragraph) => clampChars(paragraph, 340, paragraph)),
      products: content.dishes.items.slice(0, 2).map((item, index) => ({
        name: clampWords(item.title, 4, 28, evasionData.philosophy.products[index]?.name ?? ""),
        price: safePrice(
          item.price,
          evasionData.philosophy.products[index]?.price ?? ""
        ),
        image: media(
          images.dishes[index] ?? imageFromPool(productPool, index),
          evasionData.philosophy.products[index]?.image ??
            evasionData.philosophy.products[0].image
        )
      }))
    },
    featuredProducts: {
      ...evasionData.featuredProducts,
      title: clampWords(content.highlights.heading, 5, 42, evasionData.featuredProducts.title),
      subtitle: clampChars(
        content.highlights.description,
        176,
        evasionData.featuredProducts.subtitle
      ),
      items: evasionData.featuredProducts.items.map((item, index) => ({
        ...item,
        title: clampWords(highlightItems[index]?.title, 4, 28, item.title),
        description: clampWords(
          highlightItems[index]?.subtitle ?? highlightItems[index]?.note,
          3,
          26,
          item.description
        ),
        detail: clampChars(highlightItems[index]?.description, 164, item.detail ?? ""),
        eyebrow: clampWords(highlightItems[index]?.subtitle, 3, 22, item.eyebrow),
        price: safePrice(highlightItems[index]?.price, item.price ?? ""),
        image: imageUrl(images.highlights[index] ?? imageFromPool(galleryPool, index), item.image)
      }))
    },
    technology: {
      ...evasionData.technology,
      titleWords: technologyTitle.length ? technologyTitle : evasionData.technology.titleWords,
      centerImage: media(images.story ?? images.hero ?? imageFromPool(galleryPool, 0), evasionData.technology.centerImage),
      sideImages: evasionData.technology.sideImages.map((entry, index) => ({
        ...entry,
        src: imageFromPool(galleryPool, index + 1)?.url ?? entry.src,
        alt: imageFromPool(galleryPool, index + 1)?.alt ?? entry.alt
      })),
      description: clampChars(
        content.experience.description,
        260,
        evasionData.technology.description
      ),
      supportingItems: experienceItems.map((item, index) => ({
        title: clampWords(item.title, 4, 28, evasionData.technology.supportingItems?.[index]?.title ?? item.title),
        description: clampChars(
          item.description,
          164,
          evasionData.technology.supportingItems?.[index]?.description ?? item.description
        )
      }))
    },
    gallery: {
      images: evasionData.gallery.images.map((entry, index) => ({
        src: imageUrl(images.gallery[index] ?? imageFromPool(galleryPool, index), entry.src),
        alt: (images.gallery[index] ?? imageFromPool(galleryPool, index))?.alt ?? entry.alt
      }))
    },
    accessories: {
      ...evasionData.accessories,
      title: clampWords(content.dishes.heading, 5, 40, evasionData.accessories.title),
      items: evasionData.accessories.items.map((item, index) => ({
        ...item,
        title: clampWords(content.dishes.items[index]?.title, 4, 28, item.title),
        description: clampChars(content.dishes.items[index]?.description, 76, item.description),
        price: safePrice(content.dishes.items[index]?.price, item.price ?? ""),
        image: imageUrl(imageFromPool(productPool, index + 2), item.image)
      }))
    },
    editorial: {
      ...evasionData.editorial,
      intro: clampChars(
        `${content.story.description} ${content.reservation.description}`,
        220,
        evasionData.editorial.intro ?? ""
      ),
      specs: [
        {
          label: safeLabel(
            content.business.cuisine,
            evasionData.editorial.specs[0]?.label ?? "Cuisine",
            16
          ),
          value: clampWords(
            content.business.vibe,
            3,
            18,
            evasionData.editorial.specs[0]?.value ?? ""
          )
        },
        {
          label: "Signature",
          value: clampWords(
            content.highlights.items[0]?.title,
            3,
            18,
            evasionData.editorial.specs[1]?.value ?? "Chef selection"
          )
        },
        {
          label: "Experience",
          value: clampWords(
            content.experience.items[0]?.title,
            3,
            18,
            evasionData.editorial.specs[2]?.value ?? "Evening service"
          )
        },
        {
          label: "Reservations",
          value: clampWords(content.reservation.heading, 3, 20, "Reserve")
        }
      ],
      videoUrl: imageFromPool(galleryPool, 0)?.url ?? images.hero?.url ?? evasionData.editorial.videoUrl
    },
    testimonial: {
      quote: clampChars(
        `${content.story.paragraphs[0] ?? ""} ${content.story.paragraphs[1] ?? ""}`,
        280,
        evasionData.testimonial.quote
      ),
      image: media(images.story ?? imageFromPool(galleryPool, 1) ?? images.hero, evasionData.testimonial.image)
    },
    reservation: {
      ...evasionData.reservation,
      eyebrow: clampWords(content.reservation.eyebrow, 2, 20, evasionData.reservation.eyebrow),
      title: clampWords(content.reservation.heading, 5, 36, evasionData.reservation.title),
      description: clampChars(
        content.reservation.description,
        220,
        evasionData.reservation.description
      ),
      buttonLabel: clampWords(
        content.reservation.primaryLabel,
        3,
        16,
        evasionData.reservation.buttonLabel
      ),
      buttonHref: content.reservation.primaryHref
    },
    footer: {
      ...evasionData.footer,
      description: clampChars(content.footer.description, 180, evasionData.footer.description),
      columns: evasionData.footer.columns,
      legalText: content.footer.legalText,
      socials: socialLinks(content.contact.socialHref)
    }
  };
};

const mapEssenceTemplate = (
  content: RestaurantTemplateContent,
  images: TemplateImageSet,
  branding?: BrandingInput
): EssenceTemplateData => {
  const dishItems = content.dishes.items.slice(0, 3);
  const experienceItems = content.experience.items.slice(0, 4);

  return {
    ...essenceData,
    brand: content.business.name.toUpperCase(),
    logoUrl: branding?.logoUrl ?? null,
    header: {
      ...essenceData.header,
      ctaLabel: clampWords(content.reservation.primaryLabel, 3, 18, essenceData.header.ctaLabel),
      ctaHref: content.reservation.primaryHref
    },
    hero: {
      ...essenceData.hero,
      eyebrow: clampWords(content.hero.eyebrow, 3, 28, essenceData.hero.eyebrow),
      headline: [
        clampWords(content.hero.headline, 4, 30, essenceData.hero.headline[0]),
        clampWords(content.business.cuisine, 3, 22, essenceData.hero.headline[1]),
        clampWords(content.business.vibe, 3, 22, essenceData.hero.headline[2])
      ],
      description: clampChars(content.hero.subheadline, 118, essenceData.hero.description),
      ctaLabel: clampWords(content.hero.primaryCtaLabel, 3, 20, essenceData.hero.ctaLabel),
      ctaHref: content.hero.primaryCtaHref,
      heroImage: imageUrl(images.hero, essenceData.hero.heroImage),
      heroAlt: images.hero?.alt ?? essenceData.hero.heroAlt
    },
    vision: {
      ...essenceData.vision,
      heading: clampChars(content.story.heading, 96, essenceData.vision.heading),
      paragraphs: content.story.paragraphs.map((paragraph, index) =>
        clampChars(paragraph, 170, essenceData.vision.paragraphs[index] ?? paragraph)
      ),
      stats: essenceData.vision.stats.map((stat, index) => ({
        value: safePrice(content.experience.items[index]?.note, stat.value),
        label: safeLabel(content.experience.items[index]?.title, stat.label)
      }))
    },
    philosophy: {
      ...essenceData.philosophy,
      heading: clampChars(content.story.description, 86, essenceData.philosophy.heading),
      principles: content.story.principles.map((entry, index) => ({
        number: String(index + 1).padStart(2, "0"),
        title: clampWords(
          entry.title,
          4,
          30,
          essenceData.philosophy.principles[index]?.title ?? entry.title
        ),
        description: clampChars(
          entry.description,
          150,
          essenceData.philosophy.principles[index]?.description ?? entry.description
        )
      })),
      image: imageUrl(images.story, essenceData.philosophy.image),
      imageAlt: images.story?.alt ?? essenceData.philosophy.imageAlt,
      imageCaption: clampChars(
        content.business.concept,
        48,
        essenceData.philosophy.imageCaption
      )
    },
    experience: {
      ...essenceData.experience,
      heading: clampWords(content.experience.heading, 6, 48, essenceData.experience.heading),
      description: clampChars(
        content.experience.description,
        132,
        essenceData.experience.description
      ),
      image: imageUrl(images.story, essenceData.experience.image),
      imageAlt: images.story?.alt ?? essenceData.experience.imageAlt,
      steps: essenceData.experience.steps.map((step, index) => ({
        ...step,
        course: clampWords(experienceItems[index]?.title, 3, 20, step.course),
        title: clampWords(experienceItems[index]?.title, 4, 28, step.title),
        description: clampChars(experienceItems[index]?.description, 130, step.description),
        details: [
          clampChars(experienceItems[index]?.note, 24, step.details[0]),
          ...step.details.slice(1)
        ].filter(Boolean)
      }))
    },
    dishes: {
      ...essenceData.dishes,
      heading: clampWords(content.dishes.heading, 6, 44, essenceData.dishes.heading),
      note: clampChars(content.dishes.note, 120, essenceData.dishes.note),
      dishes: dishItems.map((item, index) => ({
        id: item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: clampWords(
          item.title,
          4,
          28,
          essenceData.dishes.dishes[index]?.name ?? item.title
        ),
        subtitle: clampChars(
          item.subtitle ?? item.description,
          56,
          essenceData.dishes.dishes[index]?.subtitle ?? item.description
        ),
        season: clampWords(item.season, 2, 16, "Seasonal"),
        description: clampChars(
          item.description,
          170,
          essenceData.dishes.dishes[index]?.description ?? item.description
        ),
        technique: clampChars(
          item.technique,
          34,
          essenceData.dishes.dishes[index]?.technique ?? "Chef-led execution"
        ),
        image: imageUrl(
          images.dishes[index],
          essenceData.dishes.dishes[index]?.image ??
            essenceData.dishes.dishes[0].image
        ),
        awards: item.awards ?? []
      }))
    },
    contact: {
      ...essenceData.contact,
      heading: clampWords(content.reservation.heading, 5, 36, essenceData.contact.heading),
      description: clampChars(content.contact.description, 118, essenceData.contact.description),
      restaurantAddress: content.contact.addressLines,
      reservationEmail: content.contact.email,
      phone: content.contact.phone,
      hours: content.contact.hours,
      socialLinks: socialLinks(content.contact.socialHref)
    },
    footer: {
      ...essenceData.footer,
      description: clampChars(content.footer.description, 120, essenceData.footer.description),
      legalLinks: [content.footer.legalText],
      contactAddress: content.contact.addressLines,
      contactEmail: content.contact.email,
      contactPhone: content.contact.phone,
      socialLinks: socialLinks(content.contact.socialHref),
      decorativeQuote: clampChars(
        content.story.paragraphs[0],
        96,
        essenceData.footer.decorativeQuote
      )
    }
  };
};

const mapHouslyTemplate = (
  content: RestaurantTemplateContent,
  images: TemplateImageSet,
  branding?: BrandingInput
): HouslyTemplateData => {
  const highlightItems = content.highlights.items.slice(0, 4);
  const experienceItems = content.experience.items.slice(0, 4);
  const highlightImagePool = uniqueResolvedImages([
    ...images.highlights,
    ...images.dishes,
    ...images.gallery,
    images.story,
    images.hero,
    images.location
  ]);

  return {
    ...houslyData,
    brand: safeWordmark(content.business.shortWordmark, houslyData.brand),
    logoUrl: branding?.logoUrl ?? null,
    header: {
      ...houslyData.header,
      ctaLabel: clampWords(content.reservation.primaryLabel, 3, 18, houslyData.header.ctaLabel),
      ctaHref: content.reservation.primaryHref
    },
    hero: {
      ...houslyData.hero,
      eyebrow: clampWords(content.hero.eyebrow, 3, 24, houslyData.hero.eyebrow),
      title: clampWords(content.hero.headline, 4, 28, houslyData.hero.title),
      accentTitle: clampWords(content.business.cuisine, 3, 22, houslyData.hero.accentTitle),
      description: clampChars(content.hero.subheadline, 118, houslyData.hero.description),
      backgroundImage: imageUrl(images.hero, houslyData.hero.backgroundImage),
      foregroundImage: imageUrl(images.story, houslyData.hero.foregroundImage),
      backgroundAlt: images.hero?.alt ?? houslyData.hero.backgroundAlt,
      foregroundAlt: images.story?.alt ?? houslyData.hero.foregroundAlt
    },
    philosophy: {
      ...houslyData.philosophy,
      sectionLabel: "Our story",
      title: clampWords(content.story.heading, 4, 28, houslyData.philosophy.title),
      accent: clampWords(content.business.vibe, 3, 22, houslyData.philosophy.accent),
      description: clampChars(content.story.description, 125, houslyData.philosophy.description),
      image: imageUrl(images.story, houslyData.philosophy.image),
      imageAlt: images.story?.alt ?? houslyData.philosophy.imageAlt,
      items: content.story.principles.map((item, index) => ({
        title: clampWords(item.title, 4, 28, houslyData.philosophy.items[index]?.title ?? item.title),
        description: clampChars(
          item.description,
          110,
          houslyData.philosophy.items[index]?.description ?? item.description
        )
      }))
    },
    highlights: {
      ...houslyData.highlights,
      sectionLabel: "Selected highlights",
      title: clampWords(content.highlights.heading, 5, 38, houslyData.highlights.title),
      ctaLabel: clampWords(content.hero.secondaryCtaLabel, 4, 26, houslyData.highlights.ctaLabel),
      ctaHref: content.hero.secondaryCtaHref,
      items: houslyData.highlights.items.map((item, index) => ({
        ...item,
        title: clampWords(highlightItems[index]?.title, 4, 28, item.title),
        category: clampWords(highlightItems[index]?.subtitle, 3, 22, item.category),
        detail: clampChars(highlightItems[index]?.description, 58, item.detail),
        image: imageUrl(images.highlights[index] ?? imageFromPool(highlightImagePool, index), item.image)
      }))
    },
    experience: {
      ...houslyData.experience,
      sectionLabel: "Dining experience",
      title: clampWords(content.experience.heading, 4, 30, houslyData.experience.title),
      accent: clampWords(content.business.concept, 4, 28, houslyData.experience.accent),
      description: clampChars(content.experience.description, 118, houslyData.experience.description),
      items: houslyData.experience.items.map((item, index) => ({
        ...item,
        title: clampWords(experienceItems[index]?.title, 4, 28, item.title),
        description: clampChars(experienceItems[index]?.description, 112, item.description)
      }))
    },
    faq: {
      ...houslyData.faq,
      title: clampWords(content.faq.heading, 4, 30, houslyData.faq.title),
      items: content.faq.items.map((item) => ({
        question: clampChars(item.question, 72, item.question),
        answer: clampChars(item.answer, 180, item.answer)
      }))
    },
    reservation: {
      ...houslyData.reservation,
      sectionLabel: clampWords(content.reservation.eyebrow, 3, 24, houslyData.reservation.sectionLabel),
      title: clampWords(content.reservation.heading, 5, 34, houslyData.reservation.title),
      accent: safeWordmark(content.business.shortWordmark, houslyData.reservation.accent),
      description: clampChars(content.reservation.description, 118, houslyData.reservation.description),
      primaryLabel: clampWords(content.reservation.primaryLabel, 3, 18, houslyData.reservation.primaryLabel),
      primaryHref: content.reservation.primaryHref,
      secondaryLabel: clampWords(
        content.reservation.secondaryLabel,
        3,
        18,
        houslyData.reservation.secondaryLabel
      ),
      secondaryHref: content.reservation.secondaryHref ?? houslyData.reservation.secondaryHref
    },
    footer: {
      ...houslyData.footer,
      description: clampChars(content.footer.description, 118, houslyData.footer.description),
      email: content.contact.email,
      phone: content.contact.phone,
      links: socialLinks(content.contact.socialHref),
      legal: [content.footer.legalText]
    }
  };
};

const FOOD_TRUCK_CATEGORY_IDS: FoodTruckCategory["id"][] = [
  "burgers",
  "chicken",
  "veggie",
  "drinks"
];

const mapMenuItems = <T extends FoodTruckMenuItem>(
  items: Array<{ title: string; description: string; price?: string }>,
  fallback: T[],
  imagePool: ResolvedTemplateImage[],
  offset = 0
): T[] =>
  fallback.map((item, index) => {
    const resolvedImage = imageFromPool(imagePool, offset + index);
    return {
      ...item,
      name: clampWords(items[index]?.title, 4, 26, item.name),
      description: clampChars(items[index]?.description, 88, item.description),
      price: safePrice(items[index]?.price, item.price),
      image: resolvedImage?.url ?? item.image
    };
  });

const mapFoodTruckTemplate = (
  content: RestaurantTemplateContent,
  images: TemplateImageSet,
  branding?: BrandingInput
): FoodTruckTemplateData => {
  const menuImagePool = uniqueResolvedImages([
    ...images.dishes,
    ...images.highlights,
    ...images.gallery,
    images.hero,
    images.story,
    images.location
  ]);
  const menuCategories = content.menu?.categories ?? [];
  const categoryByIndex = FOOD_TRUCK_CATEGORY_IDS.map((id, index) => ({
    id,
    source: menuCategories[index]
  }));

  return {
    ...foodTruckData,
    brand: {
      name: clampWords(content.business.name, 3, 28, foodTruckData.brand.name),
      tagline: clampChars(content.hero.subheadline, 72, foodTruckData.brand.tagline),
      logoUrl: branding?.logoUrl ?? null
    },
    header: {
      ...foodTruckData.header,
      locationLabel: clampChars(content.business.locationLabel, 28, foodTruckData.header.locationLabel)
    },
    hero: {
      ...foodTruckData.hero,
      titleTop: safeWordmark(content.business.shortWordmark, foodTruckData.hero.titleTop),
      titleBottom: clampWords(content.business.cuisine.toUpperCase(), 2, 18, foodTruckData.hero.titleBottom),
      tagline: clampWords(content.hero.headline, 6, 54, foodTruckData.hero.tagline),
      description: clampChars(content.hero.subheadline, 126, foodTruckData.hero.description),
      primaryCta: {
        label: clampWords(content.hero.primaryCtaLabel, 3, 18, foodTruckData.hero.primaryCta.label),
        href: content.hero.primaryCtaHref
      },
      secondaryCta: {
        label: clampWords(content.hero.secondaryCtaLabel, 3, 18, foodTruckData.hero.secondaryCta.label),
        href: content.hero.secondaryCtaHref
      },
      schedule: {
        eyebrow: clampWords(content.reservation.eyebrow, 3, 20, foodTruckData.hero.schedule.eyebrow),
        location: clampChars(content.business.locationLabel, 38, foodTruckData.hero.schedule.location),
        hours: clampChars(content.contact.hours[0], 28, foodTruckData.hero.schedule.hours)
      },
      stats: foodTruckData.hero.stats.map((stat, index) => ({
        value: safePrice(content.highlights.items[index]?.price, stat.value),
        label: safeLabel(content.highlights.items[index]?.title, stat.label, 14)
      })),
      heroImage: imageUrl(images.hero, foodTruckData.hero.heroImage)
    },
    menu: {
      ...foodTruckData.menu,
      heading: clampWords(content.menu?.heading, 3, 24, foodTruckData.menu.heading),
      subheading: clampChars(content.menu?.subheading, 110, foodTruckData.menu.subheading),
      promo: {
        eyebrow: clampWords(
          content.menu?.promoEyebrow,
          2,
          18,
          foodTruckData.menu.promo.eyebrow
        ),
        title: clampWords(content.menu?.promoTitle, 4, 32, foodTruckData.menu.promo.title),
        body: clampChars(content.menu?.promoBody, 70, foodTruckData.menu.promo.body)
      },
      categories: foodTruckData.menu.categories.map((category, index) => ({
        ...category,
        label: clampWords(categoryByIndex[index]?.source?.label, 3, 24, category.label)
      })),
      items: {
        burgers: mapMenuItems(categoryByIndex[0]?.source?.items ?? [], foodTruckData.menu.items.burgers, menuImagePool, 0),
        chicken: mapMenuItems(categoryByIndex[1]?.source?.items ?? [], foodTruckData.menu.items.chicken, menuImagePool, 3),
        veggie: mapMenuItems(categoryByIndex[2]?.source?.items ?? [], foodTruckData.menu.items.veggie, menuImagePool, 6),
        drinks: mapMenuItems(categoryByIndex[3]?.source?.items ?? [], foodTruckData.menu.items.drinks, menuImagePool, 8)
      },
      appetizers: foodTruckData.menu.appetizers.map((item, index) => ({
        ...item,
        image: imageUrl(imageFromPool(menuImagePool, index + 10), item.image)
      })),
      crispyChicken: foodTruckData.menu.crispyChicken.map((item, index) => ({
        ...item,
        image: imageUrl(imageFromPool(menuImagePool, index + 14), item.image)
      }))
    },
    location: {
      ...foodTruckData.location,
      heading: "LOCATION",
      description: clampChars(content.contact.description, 118, foodTruckData.location.description),
      mapImage: imageUrl(images.location, foodTruckData.location.mapImage),
      addressLines: content.contact.addressLines,
      hoursBody: clampChars(content.contact.hours.join(" · "), 80, foodTruckData.location.hoursBody),
      eventsBody: clampChars(content.experience.description, 118, foodTruckData.location.eventsBody)
    },
    contact: {
      ...foodTruckData.contact,
      description: clampChars(content.contact.description, 118, foodTruckData.contact.description),
      phone: {
        ...foodTruckData.contact.phone,
        value: content.contact.phone,
        href: `tel:${content.contact.phone.replace(/[^\d+]/g, "")}`
      },
      email: {
        ...foodTruckData.contact.email,
        value: content.contact.email,
        href: `mailto:${content.contact.email}`
      },
      instagram: {
        ...foodTruckData.contact.instagram,
        label: content.contact.socialLabel,
        value: content.contact.socialHref.replace(/^https?:\/\//, ""),
        href: content.contact.socialHref
      },
      visitBody: clampChars(content.contact.addressLines.join(", "), 84, foodTruckData.contact.visitBody),
      visitNote: clampChars(content.contact.hours.join(" · "), 80, foodTruckData.contact.visitNote)
    },
    reservation: {
      heading: clampWords(content.reservation.heading, 5, 36, foodTruckData.reservation.heading),
      description: clampChars(content.reservation.description, 100, foodTruckData.reservation.description),
      buttonLabel: clampWords(content.reservation.primaryLabel, 3, 18, foodTruckData.reservation.buttonLabel),
      buttonHref: content.reservation.primaryHref
    },
    footer: {
      ...foodTruckData.footer,
      description: clampChars(content.footer.description, 120, foodTruckData.footer.description),
      links: defaultFooterLinks(content.footer.links, foodTruckData.footer.links),
      address: clampChars(content.contact.addressLines.join(", "), 84, foodTruckData.footer.address),
      copyright: content.footer.legalText
    },
    stickyCta: {
      ...foodTruckData.stickyCta,
      locationLabel: clampWords(content.reservation.eyebrow, 3, 20, foodTruckData.stickyCta.locationLabel),
      locationDetail: clampChars(content.business.locationLabel, 28, foodTruckData.stickyCta.locationDetail),
      buttonLabel: clampWords(content.hero.primaryCtaLabel, 3, 18, foodTruckData.stickyCta.buttonLabel),
      buttonHref: content.hero.primaryCtaHref
    }
  };
};

export const mapIntegratedTemplateData = <
  TTemplate extends IntegratedTemplateId
>(
  template: TTemplate,
  content: RestaurantTemplateContent,
  images: TemplateImageSet,
  branding?: BrandingInput
): IntegratedTemplateData<TTemplate> => {
  switch (template) {
    case "evasion":
      return mapEvasionTemplate(content, images, branding) as IntegratedTemplateData<TTemplate>;
    case "essence":
      return mapEssenceTemplate(content, images, branding) as IntegratedTemplateData<TTemplate>;
    case "hously":
      return mapHouslyTemplate(content, images, branding) as IntegratedTemplateData<TTemplate>;
    case "food-truck":
      return mapFoodTruckTemplate(content, images, branding) as IntegratedTemplateData<TTemplate>;
    default:
      return mapHouslyTemplate(content, images, branding) as IntegratedTemplateData<TTemplate>;
  }
};
