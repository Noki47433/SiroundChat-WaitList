import type { ElementFrame, SiteElement, SiteImage, SiteSection } from "@/lib/website-builder/types";

const createText = (
  id: string,
  text: string,
  textStyle: "h1" | "h2" | "h3" | "body" | "caption",
  frame: ElementFrame
): SiteElement => ({
  id,
  type: "text",
  text,
  textStyle,
  frame
});

const createButton = (id: string, label: string, href: string, frame: ElementFrame): SiteElement => ({
  id,
  type: "button",
  label,
  href,
  variant: "primary",
  frame
});

const createImage = (id: string, image: SiteImage, frame: ElementFrame): SiteElement => ({
  id,
  type: "image",
  src: image.src,
  alt: image.alt,
  frame
});

const toSummaryBlock = (item: any) =>
  [item?.title, item?.name, item?.question, item?.role, item?.price, item?.body, item?.description, item?.quote, item?.answer]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 3)
    .join("\n");

export const hydrateSectionFreeformElements = (section: SiteSection): SiteElement[] => {
  if (section.elements?.length) {
    return section.elements;
  }

  const content = (section.content ?? {}) as Record<string, any>;
  const images = Array.isArray(section.images) ? section.images.filter((image) => image?.src) : [];
  const elements: SiteElement[] = [];

  const pushText = (
    key: string,
    value: unknown,
    textStyle: "h1" | "h2" | "h3" | "body" | "caption",
    frame: ElementFrame
  ) => {
    if (typeof value !== "string" || !value.trim()) return;
    elements.push(createText(`${section.id}-${key}`, value, textStyle, frame));
  };

  pushText("kicker", content.kicker, "caption", { x: 40, y: 36, width: 320, height: 36 });
  pushText("headline", content.headline ?? content.title, section.type === "hero" ? "h1" : "h2", {
    x: 40,
    y: section.type === "hero" ? 72 : 40,
    width: 540,
    height: section.type === "hero" ? 170 : 120
  });
  pushText("subheadline", content.subheadline ?? content.body, "body", {
    x: 40,
    y: section.type === "hero" ? 250 : 170,
    width: 520,
    height: 120
  });

  if (typeof content.ctaLabel === "string" && content.ctaLabel.trim()) {
    elements.push(
      createButton(`${section.id}-cta`, content.ctaLabel, content.ctaHref ?? "#contact", {
        x: 40,
        y: section.type === "hero" ? 390 : 310,
        width: 220,
        height: 56
      })
    );
  }

  images.slice(0, section.type === "gallery" ? 4 : 2).forEach((image, index) => {
    const isGallery = section.type === "gallery";
    elements.push(
      createImage(`${section.id}-image-${index}`, image, {
        x: isGallery ? 40 + (index % 2) * 320 : 650,
        y: isGallery ? 120 + Math.floor(index / 2) * 220 : 40 + index * 230,
        width: isGallery ? 280 : 420,
        height: isGallery ? 190 : 210
      })
    );
  });

  const listSource =
    Array.isArray(content.items) && content.items.length
      ? content.items
      : Array.isArray(content.plans) && content.plans.length
        ? content.plans
        : [];

  listSource.slice(0, 4).forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const block = toSummaryBlock(item);
    if (!block) return;
    elements.push(
      createText(`${section.id}-list-${index}`, block, "body", {
        x: 40 + column * 320,
        y: 360 + row * 130,
        width: 280,
        height: 110
      })
    );
  });

  if (!elements.length) {
    elements.push(
      createText(`${section.id}-placeholder`, section.name ?? "Edit this section", "body", {
        x: 40,
        y: 40,
        width: 360,
        height: 80
      })
    );
  }

  return elements;
};
