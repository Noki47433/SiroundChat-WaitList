"use client";

import type { CSSProperties, ReactNode, MouseEvent, DragEvent } from "react";
import { Rnd } from "react-rnd";
import { spacingProfiles } from "@/lib/builder/design/tokens";
import {
  renderButtonClass,
  renderEyebrowClass,
  renderImageClass,
  renderMetricClass,
  renderSurfaceClass,
  resolveSectionShell,
  resolveSiteRenderDNA
} from "@/lib/website-builder/rendering/dna";
import type {
  ContentStyle,
  ElementStyle,
  ElementFrame,
  SiteDocument,
  SiteElement,
  SiteSection,
  SiteThemeTokens
} from "@/lib/website-builder/types";
import { ContactForm, ReservationForm } from "@/components/website-builder/SiteForms";
import { trackCtaClick, type WebsiteCtaType } from "@/lib/analytics/track";

type RenderContext = {
  theme: SiteThemeTokens;
  site: SiteDocument;
  analytics?: {
    businessId?: string;
    siteId?: string | null;
    pagePath?: string;
    pageTitle?: string | null;
    enabled?: boolean;
  } | null;
  preview?: boolean;
  editor?: {
    onElementReorder?: (sectionId: string, sourceId: string, targetId: string) => void;
    onElementFrameChange?: (sectionId: string, elementId: string, frame: ElementFrame) => void;
  };
};

type SectionRenderer = (args: { section: SiteSection; ctx: RenderContext }) => JSX.Element;

const spacingClasses: Record<SiteSection["style"]["spacing"], string> = {
  compact: spacingProfiles.compact,
  normal: spacingProfiles.normal,
  airy: spacingProfiles.balanced
};

const alignmentClasses: Record<SiteSection["style"]["alignment"], string> = {
  left: "text-left",
  center: "text-center"
};

const getButtonClass = (style: SiteSection["style"], site?: SiteDocument) =>
  site
    ? renderButtonClass(site, style.buttonStyle)
    : style.buttonStyle === "outline"
      ? "border border-[color:var(--site-primary)] text-[color:var(--site-primary)]"
      : "bg-[color:var(--site-primary)] text-[color:var(--site-buttonText)]";

const clampChannel = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

const parseHex = (value?: string | null) => {
  const raw = (value ?? "").trim().replace("#", "");
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  if (raw.length === 6) return `#${raw}`;
  return null;
};

const hexToRgb = (value?: string | null) => {
  const normalized = parseHex(value);
  if (!normalized) return null;
  const hex = normalized.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((channel) => clampChannel(channel).toString(16).padStart(2, "0")).join("")}`;

const mixColor = (base?: string | null, overlay?: string | null, amount = 0.5) => {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);
  if (!baseRgb || !overlayRgb) return parseHex(base) ?? base ?? undefined;
  return rgbToHex(
    baseRgb.r + (overlayRgb.r - baseRgb.r) * amount,
    baseRgb.g + (overlayRgb.g - baseRgb.g) * amount,
    baseRgb.b + (overlayRgb.b - baseRgb.b) * amount
  );
};

const getContrastText = (background?: string | null) => {
  const rgb = hexToRgb(background);
  if (!rgb) return "#111827";
  const luminance =
    (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.6 ? "#111827" : "#FFF8F1";
};

const getSectionVars = (section: SiteSection): CSSProperties => {
  const overrides = section.style.colorOverride;
  if (!overrides) return {};
  const nextBg = parseHex(overrides.bg);
  const nextPrimary = parseHex(overrides.primary);
  const nextText = parseHex(overrides.text) ?? getContrastText(nextBg);
  const darkSurface = nextText === "#FFF8F1" || nextText === "#FFFFFF";
  const nextMuted = mixColor(nextText, nextBg ?? "#111827", darkSurface ? 0.28 : 0.56);
  const nextSurface = mixColor(nextBg ?? "#FFFFFF", darkSurface ? "#FFFFFF" : "#FFFFFF", darkSurface ? 0.08 : 0.72);
  const nextBorder = darkSurface ? "rgba(255,248,241,0.16)" : "rgba(17,24,39,0.12)";
  return {
    ["--site-primary" as any]: nextPrimary ?? undefined,
    ["--site-bg" as any]: nextBg ?? undefined,
    ["--site-text" as any]: nextText ?? undefined,
    ["--site-muted" as any]: nextMuted ?? undefined,
    ["--site-surface" as any]: nextSurface ?? undefined,
    ["--site-border" as any]: nextBorder,
    ["--site-buttonText" as any]: nextPrimary ? getContrastText(nextPrimary) : undefined
  };
};

const getTextStyleVars = (style: SiteElement & { type: "text" }) => {
  const map = {
    h1: {
      size: "var(--site-h1-size)",
      weight: "var(--site-h1-weight)",
      line: "var(--site-h1-line)",
      letter: "var(--site-h1-letter)"
    },
    h2: {
      size: "var(--site-h2-size)",
      weight: "var(--site-h2-weight)",
      line: "var(--site-h2-line)",
      letter: "var(--site-h2-letter)"
    },
    h3: {
      size: "var(--site-h3-size)",
      weight: "var(--site-h3-weight)",
      line: "var(--site-h3-line)",
      letter: "var(--site-h3-letter)"
    },
    body: {
      size: "var(--site-body-size)",
      weight: "var(--site-body-weight)",
      line: "var(--site-body-line)",
      letter: "var(--site-body-letter)"
    },
    caption: {
      size: "var(--site-caption-size)",
      weight: "var(--site-caption-weight)",
      line: "var(--site-caption-line)",
      letter: "var(--site-caption-letter)"
    }
  }[style.textStyle];

  return {
    fontSize: map.size,
    fontWeight: map.weight,
    lineHeight: map.line,
    letterSpacing: map.letter
  } as CSSProperties;
};

const getElementButtonClass = (variant?: "primary" | "outline") =>
  variant === "outline"
    ? "border border-[color:var(--site-primary)] text-[color:var(--site-primary)]"
    : "bg-[color:var(--site-primary)] text-[color:var(--site-buttonText)]";

const styleToCss = (style?: ContentStyle | ElementStyle): CSSProperties => {
  if (!style) return {};
  const boxStyle = style as ElementStyle;
  return {
    color: style.color,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    fontFamily: style.fontFamily,
    textAlign: style.textAlign,
    textTransform: style.textTransform,
    textDecoration: style.textDecoration,
    maxWidth: style.maxWidth,
    opacity: typeof style.opacity === "number" ? style.opacity : undefined,
    background: boxStyle.background,
    padding: boxStyle.padding,
    borderColor: boxStyle.borderColor,
    borderWidth: boxStyle.borderWidth,
    borderRadius: boxStyle.borderRadius,
    boxShadow: boxStyle.boxShadow
  };
};

const getContentStyle = (section: SiteSection, key: string) => {
  if (!section.contentStyles) return undefined;
  return section.contentStyles[key];
};

const ContentText = ({
  section,
  contentKey,
  as,
  className,
  children,
  defaultStyle
}: {
  section: SiteSection;
  contentKey: string;
  as: keyof JSX.IntrinsicElements;
  className?: string;
  children: ReactNode;
  defaultStyle?: CSSProperties;
}) => {
  const Tag = as as any;
  const override = getContentStyle(section, contentKey);
  const headingStyle: CSSProperties | undefined =
    as === "h1"
      ? {
          fontSize: "var(--site-h1-size)",
          fontWeight: "var(--site-h1-weight)" as any,
          lineHeight: "var(--site-h1-line)",
          letterSpacing: "var(--site-h1-letter)",
          fontFamily: "var(--site-fontHeading)",
          textTransform: "uppercase"
        }
      : as === "h2"
        ? {
            fontSize: "var(--site-h2-size)",
            fontWeight: "var(--site-h2-weight)" as any,
            lineHeight: "var(--site-h2-line)",
            letterSpacing: "var(--site-h2-letter)",
            fontFamily: "var(--site-fontHeading)",
            textTransform: "uppercase"
          }
        : as === "h3"
          ? {
              fontSize: "var(--site-h3-size)",
              fontWeight: "var(--site-h3-weight)" as any,
              lineHeight: "var(--site-h3-line)",
              letterSpacing: "var(--site-h3-letter)",
              fontFamily: "var(--site-fontHeading)"
            }
          : undefined;
  return (
    <Tag
      data-content-key={contentKey}
      data-owner-section-id={section.id}
      data-node-id={`${section.id}:${contentKey}`}
      className={className}
      style={{ ...headingStyle, ...defaultStyle, ...styleToCss(override) }}
    >
      {children}
    </Tag>
  );
};

const renderElements = (section: SiteSection, ctx: RenderContext) => {
  if (!section.elements?.length) return null;
  const isPreview = resolvePreviewMode(ctx);
  const layoutMode = section.style.layoutMode ?? "flow";
  const canReorder = layoutMode === "flow" && Boolean(ctx.editor?.onElementReorder);

  const buildDefaultFrame = (element: SiteElement, index: number): ElementFrame => {
    const baseX = 24;
    const baseY = 24 + index * 120;
    if (element.type === "image") {
      return { x: baseX, y: baseY, width: 360, height: 220 };
    }
    if (element.type === "button") {
      return { x: baseX, y: baseY, width: 200, height: 60 };
    }
    if (element.type === "spacer") {
      return { x: baseX, y: baseY, width: 240, height: element.height ?? 24 };
    }
    if (element.type === "divider") {
      return { x: baseX, y: baseY, width: 320, height: 16 };
    }
    return { x: baseX, y: baseY, width: 440, height: 140 };
  };

  const renderElementInner = (
    element: SiteElement,
    options: {
      dragClass?: string;
      wrapperClass?: string;
      dragBadge?: ReactNode;
      extraProps?: Record<string, any>;
    }
  ) => {
    const { dragClass = "", wrapperClass = "", dragBadge = null, extraProps = {} } = options;
    const baseElementProps = {
      "data-element-id": element.id,
      "data-node-id": element.id,
      ...extraProps,
      onClick: (event: MouseEvent) => {
        if (!isPreview) return;
        event.stopPropagation();
        if (typeof window !== "undefined" && window.parent !== window) {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          window.parent.postMessage(
            {
              type: "element:select",
              sectionId: section.id,
              elementId: element.id,
              rect: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
              }
            },
            "*"
          );
        }
      }
    };

    if (element.type === "text") {
      const Tag =
        element.textStyle === "h1"
          ? "h1"
          : element.textStyle === "h2"
            ? "h2"
            : element.textStyle === "h3"
              ? "h3"
              : "p";
      const elementStyle = styleToCss(element.style);
      return (
        <div className={wrapperClass} {...baseElementProps}>
          {dragBadge}
          <Tag
            className={`${element.align === "center" ? "text-center" : "text-left"} outline outline-2 outline-transparent hover:outline-[color:var(--site-primary)] hover:outline-offset-4 transition ${dragClass}`}
            style={{
              ...getTextStyleVars(element),
              fontFamily: element.textStyle.startsWith("h")
                ? "var(--site-fontHeading)"
                : "var(--site-fontBody)",
              color: "var(--site-text)",
              ...elementStyle
            }}
          >
            {element.text}
          </Tag>
        </div>
      );
    }
    if (element.type === "image") {
      const elementStyle = styleToCss(element.style);
      return (
        <div className={wrapperClass} {...baseElementProps}>
          {dragBadge}
          <figure
            className={`space-y-2 outline outline-2 outline-transparent hover:outline-[color:var(--site-primary)] hover:outline-offset-4 transition ${dragClass}`}
            style={elementStyle}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={element.src}
              alt={element.alt ?? "Site image"}
              width={1200}
              height={800}
              className="h-auto w-full rounded-2xl object-cover"
              draggable={false}
            />
            {element.caption ? (
              <figcaption className="text-xs text-[color:var(--site-muted)]">{element.caption}</figcaption>
            ) : null}
          </figure>
        </div>
      );
    }
    if (element.type === "button") {
      const elementStyle = styleToCss(element.style);
      return (
        <div className={wrapperClass} {...baseElementProps}>
          {dragBadge}
          <div
            className={`${element.align === "center" ? "text-center" : "text-left"} outline outline-2 outline-transparent hover:outline-[color:var(--site-primary)] hover:outline-offset-4 transition ${dragClass}`}
            style={elementStyle}
          >
            <a
              href={element.href}
              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${getElementButtonClass(
                element.variant
              )}`}
              onClick={getCtaHandler(element.href, ctx)}
              draggable={false}
            >
              {element.label}
            </a>
          </div>
        </div>
      );
    }
    if (element.type === "spacer") {
      const elementStyle = styleToCss(element.style);
      return (
        <div className={wrapperClass} {...baseElementProps}>
          {dragBadge}
          <div
            className={`outline outline-2 outline-transparent hover:outline-[color:var(--site-primary)] hover:outline-offset-4 transition ${dragClass}`}
            style={{ height: element.height ?? 24, ...elementStyle }}
          />
        </div>
      );
    }
    if (element.type === "divider") {
      const elementStyle = styleToCss(element.style);
      return (
        <div className={wrapperClass} {...baseElementProps}>
          {dragBadge}
          <div
            className={`outline outline-2 outline-transparent hover:outline-[color:var(--site-primary)] hover:outline-offset-4 transition ${dragClass}`}
            style={elementStyle}
          >
            <hr
              style={{
                borderColor: element.color ?? "var(--site-border)",
                borderTopWidth: element.thickness ?? 1
              }}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  if (layoutMode === "freeform") {
    const frames = section.elements.map((element, index) => element.frame ?? buildDefaultFrame(element, index));
    const maxY = frames.reduce((max, frame) => Math.max(max, frame.y + frame.height), 0);
    const containerHeight = Math.max(260, maxY + 40);
    const isEditable = Boolean(ctx.editor?.onElementFrameChange);
    return (
      <div className="mt-8" style={{ position: "relative", minHeight: containerHeight }}>
        {section.elements.map((element, index) => {
          const frame = element.frame ?? frames[index];
          if (!isEditable) {
            return (
              <div
                key={element.id}
                style={{ position: "absolute", left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
              >
                {renderElementInner(element, {
                  dragClass: "",
                  wrapperClass: "h-full w-full",
                  dragBadge: null
                })}
              </div>
            );
          }
          return (
            <Rnd
              key={element.id}
              bounds="parent"
              size={{ width: frame.width, height: frame.height }}
              position={{ x: frame.x, y: frame.y }}
              minWidth={80}
              minHeight={40}
              disableDragging={!isEditable}
              enableResizing={isEditable}
              onDragStop={(_, data) => {
                ctx.editor?.onElementFrameChange?.(section.id, element.id, {
                  ...frame,
                  x: data.x,
                  y: data.y
                });
              }}
              onResizeStop={(_, __, ref, ___, position) => {
                const width = Math.max(80, ref.offsetWidth);
                const height = Math.max(40, ref.offsetHeight);
                ctx.editor?.onElementFrameChange?.(section.id, element.id, {
                  x: position.x,
                  y: position.y,
                  width,
                  height
                });
              }}
            >
              <div className="h-full w-full">
                {renderElementInner(element, {
                  dragClass: "cursor-move",
                  wrapperClass:
                    "h-full w-full rounded-2xl border border-dashed border-transparent hover:border-[color:var(--site-primary)]",
                  dragBadge: isEditable ? (
                    <span className="absolute -left-2 top-2 rounded-full border border-[color:var(--site-border)] bg-white px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[color:var(--site-muted)]">
                      Drag
                    </span>
                  ) : null
                })}
              </div>
            </Rnd>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {section.elements.map((element) => {
        const dragClass = canReorder ? "cursor-grab active:cursor-grabbing" : "";
        const wrapperClass = canReorder
          ? "relative rounded-2xl border border-dashed border-transparent hover:border-[color:var(--site-primary)]"
          : "";
        const dragBadge = canReorder ? (
          <span
            className="absolute -left-2 top-2 rounded-full border border-[color:var(--site-border)] bg-white px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[color:var(--site-muted)]"
            data-drag-handle
          >
            Drag
          </span>
        ) : null;
        const handleDragStart = (event: DragEvent<HTMLElement>) => {
          if (!canReorder) return;
          event.dataTransfer.setData("text/plain", element.id);
          event.dataTransfer.effectAllowed = "move";
        };
        const handleDragOver = (event: DragEvent<HTMLElement>) => {
          if (!canReorder) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        };
        const handleDrop = (event: DragEvent<HTMLElement>) => {
          if (!canReorder) return;
          event.preventDefault();
          const sourceId = event.dataTransfer.getData("text/plain");
          if (!sourceId || sourceId === element.id) return;
          ctx.editor?.onElementReorder?.(section.id, sourceId, element.id);
        };
        const baseElementProps = canReorder
          ? {
              draggable: true,
              onDragStart: handleDragStart,
              onDragOver: handleDragOver,
              onDrop: handleDrop
            }
          : {};
        return renderElementInner(element, {
          dragClass,
          wrapperClass,
          dragBadge,
          extraProps: baseElementProps
        });
      })}
    </div>
  );
};

const getBackgroundLayers = (section: SiteSection) => {
  const background = section.style.background;
  if (background.type === "plain") return { base: null, overlay: null };

  if (background.type === "gradient") {
    const stops = background.stops;
    const angle = typeof background.angle === "number" ? background.angle : 135;
    const gradient =
      background.value ??
      (stops?.length
        ? `linear-gradient(${angle}deg, ${stops
            .map((stop) => `${stop.color} ${stop.position}%`)
            .join(", ")})`
        : "linear-gradient(135deg, var(--site-surface), var(--site-bg))");
    return {
      base: <div className="absolute inset-0" style={{ backgroundImage: gradient }} />,
      overlay: null
    };
  }

  const imageSrc = background.value ?? section.images?.[0]?.src;
  if (!imageSrc) {
    return { base: null, overlay: null };
  }

  const overlayOpacity = Math.max(background.overlay ?? 0.45, 0.45);
  return {
    base: (
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${imageSrc})`,
          backgroundSize: background.size ?? "cover",
          backgroundPosition: background.position ?? "center",
          backgroundRepeat: background.repeat ?? "no-repeat"
        }}
      />
    ),
    overlay: <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />
  };
};

const SectionWrapper = ({
  section,
  children,
  className,
  ctx,
  containerClassName
}: {
  section: SiteSection;
  children: ReactNode;
  className?: string;
  ctx: RenderContext;
  containerClassName?: string;
}) => {
  const { base, overlay } = getBackgroundLayers(section);
  const isPreview = resolvePreviewMode(ctx);
  const shell = resolveSectionShell(ctx.site, section, {
    sectionClassName: className,
    containerClassName
  });
  const previewClasses = isPreview
    ? "outline outline-2 outline-transparent hover:outline-[color:var(--site-primary)] hover:outline-offset-6 transition"
    : "";
  return (
    <section
      data-section-id={section.id}
      data-node-id={section.id}
      id={section.id}
      className={`relative ${spacingClasses[section.style.spacing]} ${
        alignmentClasses[section.style.alignment]
      } overflow-x-hidden bg-[color:var(--site-bg)] text-[color:var(--site-text)] ${previewClasses} ${
        shell.sectionClassName ?? ""
      }`}
      style={getSectionVars(section)}
      onClick={(event) => {
        if (!isPreview) return;
        if (typeof window !== "undefined" && window.parent !== window) {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          window.parent.postMessage(
            {
              type: "section:select",
              sectionId: section.id,
              rect: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
              }
            },
            "*"
          );
        }
      }}
    >
      {base}
      {overlay}
      <div className={`relative z-10 ${shell.containerClassName ?? "mx-auto w-full min-w-0 max-w-6xl px-6"}`}>
        {children}
        {renderElements(section, ctx)}
      </div>
    </section>
  );
};

const FreeformSection: SectionRenderer = ({ section, ctx }) => (
  <SectionWrapper section={section} ctx={ctx}>
    {section.elements?.length ? null : (
      <div className="rounded-[1.5rem] border border-dashed border-[color:var(--site-border)] bg-[color:var(--site-surface)]/60 px-6 py-10 text-center text-sm text-[color:var(--site-muted)]">
        Add elements to arrange this section freely.
      </div>
    )}
  </SectionWrapper>
);

const getFirstImage = (section: SiteSection) => section.images?.[0];

const getImageBySlot = (section: SiteSection, slot: string) =>
  section.images?.find((image) => image.slot === slot) ?? section.images?.[0];

const normalizeList = <T,>(value: T[] | undefined, fallback: T[]) =>
  Array.isArray(value) && value.length ? value : fallback;

const resolvePreviewMode = (ctx?: RenderContext) => {
  if (typeof ctx?.preview === "boolean") {
    if (!ctx.preview) return false;
    if (typeof window === "undefined") return false;
    return window.parent !== window;
  }
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") !== "true") return false;
  return window.parent !== window;
};

const resolveSiteSlug = () => {
  if (typeof window === "undefined") return undefined;
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1];
};

const resolvePageHref = (pageSlug: string) => {
  const siteSlug = resolveSiteSlug();
  if (!siteSlug) return `?page=${pageSlug}`;
  return `/s/${siteSlug}?page=${pageSlug}`;
};

const resolvePagePath = (ctx?: RenderContext) => {
  if (ctx?.analytics?.pagePath) return ctx.analytics.pagePath;
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
};

const getCtaTypeFromHref = (href?: string | null): WebsiteCtaType => {
  if (!href) return "other";
  const normalized = href.toLowerCase();
  if (normalized.startsWith("tel:")) return "call";
  if (normalized.startsWith("mailto:")) return "email";
  if (normalized.includes("wa.me") || normalized.startsWith("whatsapp:")) return "whatsapp";
  if (normalized.includes("maps.google") || normalized.includes("google.com/maps") || normalized.startsWith("geo:")) {
    return "directions";
  }
  if (normalized.includes("book") || normalized.includes("reserve") || normalized.includes("appointment")) return "booking";
  return "other";
};

const getCtaHandler = (href: string | undefined, ctx: RenderContext) => () => {
  const analytics = ctx.analytics;
  if (!analytics?.enabled) return;
  if (!analytics.businessId && !analytics.siteId) return;

  trackCtaClick({
    businessId: analytics.businessId,
    siteId: analytics.siteId ?? null,
    pagePath: resolvePagePath(ctx),
    pageTitle: analytics.pageTitle ?? null,
    ctaType: getCtaTypeFromHref(href)
  });
};

const HeroA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const image = getImageBySlot(section, "hero");
  const hasImage = Boolean(image?.src);
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className={`grid items-center gap-10 ${hasImage ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
        <div className="space-y-5">
          <ContentText
            section={section}
            contentKey="kicker"
            as="p"
            className="text-xs uppercase tracking-[0.3em] text-[color:var(--site-muted)]"
          >
            {content.kicker ?? "Welcome"}
          </ContentText>
          <ContentText
            section={section}
            contentKey="headline"
            as="h1"
            className="text-4xl font-semibold text-[color:var(--site-text)] md:text-5xl"
          >
            {content.headline}
          </ContentText>
          <ContentText
            section={section}
            contentKey="subheadline"
            as="p"
            className="text-base text-[color:var(--site-muted)]"
          >
            {content.subheadline}
          </ContentText>
          <a
            href={content.ctaHref}
            className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${getButtonClass(
              section.style
            )}`}
            onClick={getCtaHandler(content.ctaHref, ctx)}
          >
            <ContentText section={section} contentKey="ctaLabel" as="span">
              {content.ctaLabel}
            </ContentText>
          </a>
        </div>
        {hasImage ? (
          <div className="overflow-hidden rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image!.src}
              alt={image!.alt ?? "Hero"}
              width={image!.width ?? 1600}
              height={image!.height ?? 1000}
              className="h-auto w-full object-cover"
            />
          </div>
        ) : null}
      </div>
    </SectionWrapper>
  );
};

const HeroB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const image = getImageBySlot(section, "hero");
  const backgroundValue = image?.src;
  const overlay = section.style.background.type === "image" ? section.style.background.overlay : undefined;
  const styledSection: SiteSection = {
    ...section,
    style: {
      ...section.style,
      background: backgroundValue
        ? {
            type: "image",
            value: backgroundValue,
            overlay: overlay ?? 0.5,
            size: "cover",
            position: "center",
            repeat: "no-repeat"
          }
        : { type: "plain" }
    }
  };

  return (
    <SectionWrapper section={styledSection} className="text-center" ctx={ctx}>
      <div className="mx-auto max-w-3xl space-y-6">
        <ContentText
          section={section}
          contentKey="kicker"
          as="p"
          className="text-xs uppercase tracking-[0.3em] text-white/70"
        >
          {content.kicker ?? "Signature"}
        </ContentText>
        <ContentText section={section} contentKey="headline" as="h1" className="text-4xl font-semibold text-white md:text-5xl">
          {content.headline}
        </ContentText>
        <ContentText section={section} contentKey="subheadline" as="p" className="text-base text-white/80">
          {content.subheadline}
        </ContentText>
        <a
          href={content.ctaHref}
          className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${getButtonClass(
            section.style
          )}`}
          onClick={getCtaHandler(content.ctaHref, ctx)}
        >
          <ContentText section={section} contentKey="ctaLabel" as="span">
            {content.ctaLabel}
          </ContentText>
        </a>
      </div>
    </SectionWrapper>
  );
};

const HeroC: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const image = getImageBySlot(section, "hero");
  const features = Array.isArray(content.features)
    ? content.features.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const hasFeatures = features.length > 0;

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <ContentText
            section={section}
            contentKey="headline"
            as="h1"
            className="text-4xl font-semibold text-[color:var(--site-text)] md:text-5xl"
          >
            {content.headline}
          </ContentText>
          <ContentText
            section={section}
            contentKey="subheadline"
            as="p"
            className="text-base text-[color:var(--site-muted)]"
          >
            {content.subheadline}
          </ContentText>
          {hasFeatures ? (
            <ul className="space-y-3 text-sm text-[color:var(--site-muted)]">
              {features.slice(0, 3).map((item: string, index: number) => (
                <li key={`${item}-${index}`} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--site-primary)]" />
                  <ContentText section={section} contentKey={`features.${index}`} as="span">
                    {item}
                  </ContentText>
                </li>
              ))}
            </ul>
          ) : null}
          <a
            href={content.ctaHref}
            className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${getButtonClass(
              section.style
            )}`}
            onClick={getCtaHandler(content.ctaHref, ctx)}
          >
            <ContentText section={section} contentKey="ctaLabel" as="span">
              {content.ctaLabel}
            </ContentText>
          </a>
        </div>
        <div className="overflow-hidden rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              alt={image.alt ?? "Hero"}
              width={image.width ?? 1600}
              height={image.height ?? 1000}
              className="h-auto w-full object-cover"
            />
          ) : null}
        </div>
      </div>
    </SectionWrapper>
  );
};

const ServicesA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = normalizeList(content.items, [
    { title: "Signature service", body: "Describe your key offering in a short sentence." },
    { title: "Customer care", body: "Share how you support clients end-to-end." },
    { title: "Ongoing results", body: "Explain how you keep improving outcomes." }
  ]);

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-8">
        <div className="space-y-3">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText
              section={section}
              contentKey="subtitle"
              as="p"
              className="text-sm text-[color:var(--site-muted)]"
            >
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item: any, index: number) => (
            <div
              key={`${item.title}-${index}`}
              className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5 shadow-soft"
            >
              <ContentText
                section={section}
                contentKey={`items.${index}.title`}
                as="h3"
                className="text-sm font-semibold text-[color:var(--site-text)]"
              >
                {item.title}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`items.${index}.body`}
                as="p"
                className="mt-2 text-sm text-[color:var(--site-muted)]"
              >
                {item.body}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const ServicesB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = normalizeList(content.items, [
    { title: "Core offering", body: "Explain the value of this service." },
    { title: "Premium support", body: "Share the experience customers get." },
    { title: "Results driven", body: "Describe the outcomes you deliver." }
  ]);

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-8">
        <ContentText
          section={section}
          contentKey="title"
          as="h2"
          className="text-2xl font-semibold text-[color:var(--site-text)]"
        >
          {content.title}
        </ContentText>
        <div className="space-y-4">
          {items.map((item: any, index: number) => (
            <div
              key={`${item.title}-${index}`}
              className="flex flex-wrap items-start justify-between gap-6 rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--site-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <ContentText
                  section={section}
                  contentKey={`items.${index}.title`}
                  as="h3"
                  className="mt-2 text-base font-semibold text-[color:var(--site-text)]"
                >
                  {item.title}
                </ContentText>
              </div>
              <ContentText
                section={section}
                contentKey={`items.${index}.body`}
                as="p"
                className="max-w-xl text-sm text-[color:var(--site-muted)]"
              >
                {item.body}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const ServicesC: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = normalizeList(content.items, [
    { title: "Discovery", body: "We learn your goals and map priorities." },
    { title: "Execution", body: "We deliver work with clear checkpoints." },
    { title: "Optimization", body: "We refine continuously for growth." }
  ]);

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="space-y-4">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          <ContentText
            section={section}
            contentKey="subtitle"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.subtitle ?? content.description}
          </ContentText>
          <a
            href={content.ctaHref ?? "#contact"}
            className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-semibold uppercase tracking-[0.2em] ${getButtonClass(
              section.style
            )}`}
            onClick={getCtaHandler(content.ctaHref ?? "#contact", ctx)}
          >
            <ContentText section={section} contentKey="ctaLabel" as="span">
              {content.ctaLabel ?? "Learn more"}
            </ContentText>
          </a>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item: any, index: number) => (
            <div
              key={`${item.title}-${index}`}
              className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5"
            >
              <ContentText
                section={section}
                contentKey={`items.${index}.title`}
                as="h3"
                className="text-sm font-semibold text-[color:var(--site-text)]"
              >
                {item.title}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`items.${index}.body`}
                as="p"
                className="mt-2 text-sm text-[color:var(--site-muted)]"
              >
                {item.body}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const AboutA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const bullets = Array.isArray(content.bullets)
    ? content.bullets.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const hasBullets = bullets.length > 0;

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className={`grid gap-10 ${hasBullets ? "lg:grid-cols-[1fr_1fr]" : ""}`}>
        <div className="space-y-4">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          <ContentText
            section={section}
            contentKey="body"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.body}
          </ContentText>
        </div>
        {hasBullets ? (
          <div className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--site-muted)]">Why us</p>
            <ul className="mt-4 space-y-3 text-sm text-[color:var(--site-text)]">
              {bullets.map((item: string, index: number) => (
                <li key={`${item}-${index}`} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--site-primary)]" />
                  <ContentText section={section} contentKey={`bullets.${index}`} as="span">
                    {item}
                  </ContentText>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SectionWrapper>
  );
};

const AboutB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const stats = Array.isArray(content.stats)
    ? content.stats.filter(
        (item: unknown): item is { label: string; value: string } =>
          Boolean(
            item &&
              typeof item === "object" &&
              typeof (item as any).label === "string" &&
              typeof (item as any).value === "string"
          )
      )
    : [];

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-8">
        <div className="space-y-3">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          <ContentText
            section={section}
            contentKey="body"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.body}
          </ContentText>
        </div>
        {stats.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((stat: any, index: number) => (
              <div
                key={`${stat.label}-${index}`}
                className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5 text-center"
              >
                <ContentText
                  section={section}
                  contentKey={`stats.${index}.value`}
                  as="p"
                  className="text-2xl font-semibold text-[color:var(--site-text)]"
                >
                  {stat.value}
                </ContentText>
                <ContentText
                  section={section}
                  contentKey={`stats.${index}.label`}
                  as="p"
                  className="mt-2 text-xs uppercase tracking-[0.2em] text-[color:var(--site-muted)]"
                >
                  {stat.label}
                </ContentText>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </SectionWrapper>
  );
};

const GalleryA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const images = normalizeList(section.images, []).filter((image: any) => Boolean(image?.src));
  if (!images.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-6">
        <ContentText
          section={section}
          contentKey="title"
          as="h2"
          className="text-2xl font-semibold text-[color:var(--site-text)]"
        >
          {content.title}
        </ContentText>
        <div className="grid gap-4 md:grid-cols-3">
          {images.map((image: any, index: number) => (
            <div
              key={`${image.src}-${index}`}
              className="overflow-hidden rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)]"
            >
              {image.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.src}
                  alt={image.alt ?? "Gallery"}
                  width={image.width ?? 1200}
                  height={image.height ?? 900}
                  className="h-48 w-full object-cover"
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const GalleryB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const images = normalizeList(section.images, []).filter((image: any) => Boolean(image?.src));
  if (!images.length) return <></>;
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText
              section={section}
              contentKey="subtitle"
              as="p"
              className="text-sm text-[color:var(--site-muted)]"
            >
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {images.map((image: any, index: number) => (
            <div
              key={`${image.src}-${index}`}
              className={`aspect-[4/3] overflow-hidden rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] ${
                index === 0 ? "md:row-span-2" : ""
              }`}
            >
              {image.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.src}
                  alt={image.alt ?? "Gallery"}
                  width={image.width ?? 1200}
                  height={image.height ?? 900}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const TestimonialsA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = Array.isArray(content.items) ? content.items : [];
  if (!items.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-8">
        <ContentText
          section={section}
          contentKey="title"
          as="h2"
          className="text-2xl font-semibold text-[color:var(--site-text)]"
        >
          {content.title}
        </ContentText>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item: any, index: number) => (
            <div
              key={`${item.name}-${index}`}
              className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5"
            >
              <ContentText
                section={section}
                contentKey={`items.${index}.quote`}
                as="p"
                className="text-sm text-[color:var(--site-muted)]"
              >
                &quot;{item.quote}&quot;
              </ContentText>
              <ContentText
                section={section}
                contentKey={`items.${index}.name`}
                as="p"
                className="mt-4 text-sm font-semibold text-[color:var(--site-text)]"
              >
                {item.name}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`items.${index}.role`}
                as="p"
                className="text-xs uppercase tracking-[0.2em] text-[color:var(--site-muted)]"
              >
                {item.role}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const TestimonialsB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = Array.isArray(content.items) ? content.items : [];
  if (!items.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          <ContentText
            section={section}
            contentKey="subtitle"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.subtitle ?? content.description}
          </ContentText>
        </div>
        <div className="space-y-4">
          {items.map((item: any, index: number) => (
            <div
              key={`${item.name}-${index}`}
              className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5"
            >
              <ContentText
                section={section}
                contentKey={`items.${index}.quote`}
                as="p"
                className="text-sm text-[color:var(--site-muted)]"
              >
                &quot;{item.quote}&quot;
              </ContentText>
              <div className="mt-4">
                <ContentText
                  section={section}
                  contentKey={`items.${index}.name`}
                  as="p"
                  className="text-sm font-semibold text-[color:var(--site-text)]"
                >
                  {item.name}
                </ContentText>
                <ContentText
                  section={section}
                  contentKey={`items.${index}.role`}
                  as="p"
                  className="text-xs uppercase tracking-[0.2em] text-[color:var(--site-muted)]"
                >
                  {item.role}
                </ContentText>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const PricingA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const plans = normalizeList(content.plans, [
    { name: "Starter", price: "$99", description: "Essentials to get started.", features: ["Core setup", "Email support"] },
    { name: "Growth", price: "$199", description: "Best for growing teams.", features: ["Priority support", "Reporting"] },
    { name: "Premium", price: "$299", description: "Full-service partnership.", features: ["Strategy sessions", "Custom work"] }
  ]);

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-8">
        <div className="space-y-3">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText
              section={section}
              contentKey="subtitle"
              as="p"
              className="text-sm text-[color:var(--site-muted)]"
            >
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan: any, index: number) => (
            <div
              key={`${plan.name}-${index}`}
              className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-6"
            >
              <ContentText
                section={section}
                contentKey={`plans.${index}.name`}
                as="p"
                className="text-xs uppercase tracking-[0.2em] text-[color:var(--site-muted)]"
              >
                {plan.name}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`plans.${index}.price`}
                as="p"
                className="mt-3 text-3xl font-semibold text-[color:var(--site-text)]"
              >
                {plan.price}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`plans.${index}.description`}
                as="p"
                className="mt-2 text-sm text-[color:var(--site-muted)]"
              >
                {plan.description}
              </ContentText>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--site-muted)]">
                {normalizeList(plan.features, []).slice(0, 4).map((feature: string, featureIndex: number) => (
                  <li key={`${plan.name}-${featureIndex}`} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[color:var(--site-primary)]" />
                    <ContentText
                      section={section}
                      contentKey={`plans.${index}.features.${featureIndex}`}
                      as="span"
                    >
                      {feature}
                    </ContentText>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const PricingB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const plans = normalizeList(content.plans, [
    { name: "Standard", price: "$120", description: "Reliable coverage.", features: ["Setup", "Support"] },
    { name: "Plus", price: "$240", description: "Extra insights.", features: ["Reporting", "Optimization"] }
  ]);

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          <ContentText
            section={section}
            contentKey="subtitle"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.subtitle ?? content.description}
          </ContentText>
          <a
            href={content.ctaHref ?? "#contact"}
            className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-semibold uppercase tracking-[0.2em] ${getButtonClass(
              section.style
            )}`}
            onClick={getCtaHandler(content.ctaHref ?? "#contact", ctx)}
          >
            <ContentText section={section} contentKey="ctaLabel" as="span">
              {content.ctaLabel ?? "Get started"}
            </ContentText>
          </a>
        </div>
        <div className="space-y-4">
          {plans.map((plan: any, index: number) => (
            <div
              key={`${plan.name}-${index}`}
              className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5"
            >
              <div className="flex items-center justify-between">
                <ContentText
                  section={section}
                  contentKey={`plans.${index}.name`}
                  as="p"
                  className="text-base font-semibold text-[color:var(--site-text)]"
                >
                  {plan.name}
                </ContentText>
                <ContentText
                  section={section}
                  contentKey={`plans.${index}.price`}
                  as="p"
                  className="text-lg font-semibold text-[color:var(--site-text)]"
                >
                  {plan.price}
                </ContentText>
              </div>
              <ContentText
                section={section}
                contentKey={`plans.${index}.description`}
                as="p"
                className="mt-2 text-sm text-[color:var(--site-muted)]"
              >
                {plan.description}
              </ContentText>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--site-muted)]">
                {normalizeList(plan.features, []).map((feature: string, featureIndex: number) => (
                  <li key={`${plan.name}-${featureIndex}`} className="rounded-full border border-[color:var(--site-border)] px-2 py-1">
                    <ContentText
                      section={section}
                      contentKey={`plans.${index}.features.${featureIndex}`}
                      as="span"
                    >
                      {feature}
                    </ContentText>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const CtaA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-8 md:flex-row md:items-center">
        <div className="space-y-2">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          <ContentText
            section={section}
            contentKey="body"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.body}
          </ContentText>
        </div>
        <a
          href={content.ctaHref ?? "#contact"}
          className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${getButtonClass(
            section.style
          )}`}
          onClick={getCtaHandler(content.ctaHref ?? "#contact", ctx)}
        >
          <ContentText section={section} contentKey="ctaLabel" as="span">
            {content.ctaLabel}
          </ContentText>
        </a>
      </div>
    </SectionWrapper>
  );
};

const CtaB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid gap-8 rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <ContentText
            section={section}
            contentKey="kicker"
            as="p"
            className="text-xs uppercase tracking-[0.3em] text-[color:var(--site-muted)]"
          >
            {content.kicker ?? "Ready to start"}
          </ContentText>
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-3xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          <ContentText
            section={section}
            contentKey="body"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.body}
          </ContentText>
        </div>
        <div className="flex items-center justify-start lg:justify-end">
          <a
            href={content.ctaHref ?? "#contact"}
            className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${getButtonClass(
              section.style
            )}`}
            onClick={getCtaHandler(content.ctaHref ?? "#contact", ctx)}
          >
            <ContentText section={section} contentKey="ctaLabel" as="span">
              {content.ctaLabel}
            </ContentText>
          </a>
        </div>
      </div>
    </SectionWrapper>
  );
};

const FaqA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = normalizeList(content.items, [
    { question: "What areas do you serve?", answer: "We serve the local area and nearby neighborhoods." },
    { question: "How quickly can we start?", answer: "Most projects start within 1-2 weeks." }
  ]);

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-6">
        <ContentText
          section={section}
          contentKey="title"
          as="h2"
          className="text-2xl font-semibold text-[color:var(--site-text)]"
        >
          {content.title}
        </ContentText>
        <div className="space-y-4">
          {items.map((item: any, index: number) => (
            <div key={`${item.question}-${index}`} className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5">
              <ContentText
                section={section}
                contentKey={`items.${index}.question`}
                as="p"
                className="text-sm font-semibold text-[color:var(--site-text)]"
              >
                {item.question}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`items.${index}.answer`}
                as="p"
                className="mt-2 text-sm text-[color:var(--site-muted)]"
              >
                {item.answer}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const FaqB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = normalizeList(content.items, []);
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid gap-8 lg:grid-cols-[0.6fr_1.4fr]">
        <div className="space-y-3">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText
              section={section}
              contentKey="subtitle"
              as="p"
              className="text-sm text-[color:var(--site-muted)]"
            >
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item: any, index: number) => (
            <div
              key={`${item.question}-${index}`}
              className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5"
            >
              <ContentText
                section={section}
                contentKey={`items.${index}.question`}
                as="p"
                className="text-sm font-semibold text-[color:var(--site-text)]"
              >
                {item.question}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`items.${index}.answer`}
                as="p"
                className="mt-2 text-sm text-[color:var(--site-muted)]"
              >
                {item.answer}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const ContactA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const siteSlug = resolveSiteSlug();
  const mode = resolvePreviewMode() ? "preview" : "live";
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          <ContentText
            section={section}
            contentKey="body"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.body}
          </ContentText>
          <div className="space-y-2 text-sm text-[color:var(--site-muted)]">
            {content.email ? (
              <ContentText section={section} contentKey="email" as="p">
                Email: {content.email}
              </ContentText>
            ) : null}
            {content.phone ? (
              <ContentText section={section} contentKey="phone" as="p">
                Phone: {content.phone}
              </ContentText>
            ) : null}
            {content.address ? (
              <ContentText section={section} contentKey="address" as="p">
                Address: {content.address}
              </ContentText>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-6">
        <ContactForm mode={mode} siteSlug={siteSlug} analytics={ctx.analytics ?? undefined} />
        </div>
      </div>
    </SectionWrapper>
  );
};

const ContactB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const siteSlug = resolveSiteSlug();
  const mode = resolvePreviewMode() ? "preview" : "live";
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-6">
        <ContactForm mode={mode} siteSlug={siteSlug} analytics={ctx.analytics ?? undefined} />
        </div>
        <div className="space-y-4">
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          <ContentText
            section={section}
            contentKey="body"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.body}
          </ContentText>
          <div className="space-y-2 text-sm text-[color:var(--site-muted)]">
            {content.email ? (
              <ContentText section={section} contentKey="email" as="p">
                Email: {content.email}
              </ContentText>
            ) : null}
            {content.phone ? (
              <ContentText section={section} contentKey="phone" as="p">
                Phone: {content.phone}
              </ContentText>
            ) : null}
            {content.address ? (
              <ContentText section={section} contentKey="address" as="p">
                Address: {content.address}
              </ContentText>
            ) : null}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

const ReservationA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const siteSlug = resolveSiteSlug();
  const mode = resolvePreviewMode() ? "preview" : "live";
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-8">
        <ContentText
          section={section}
          contentKey="title"
          as="h2"
          className="text-2xl font-semibold text-[color:var(--site-text)]"
        >
          {content.title}
        </ContentText>
        <ContentText
          section={section}
          contentKey="body"
          as="p"
          className="mt-2 text-sm text-[color:var(--site-muted)]"
        >
          {content.body}
        </ContentText>
        <div className="mt-6">
        <ReservationForm mode={mode} siteSlug={siteSlug} analytics={ctx.analytics ?? undefined} />
        </div>
      </div>
    </SectionWrapper>
  );
};

const ReservationB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const siteSlug = resolveSiteSlug();
  const mode = resolvePreviewMode() ? "preview" : "live";
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <ContentText
            section={section}
            contentKey="kicker"
            as="p"
            className="text-xs uppercase tracking-[0.3em] text-[color:var(--site-muted)]"
          >
            {content.kicker ?? "Book your visit"}
          </ContentText>
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-3xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title}
          </ContentText>
          <ContentText
            section={section}
            contentKey="body"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.body}
          </ContentText>
        </div>
        <div className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-6">
        <ReservationForm mode={mode} siteSlug={siteSlug} analytics={ctx.analytics ?? undefined} />
        </div>
      </div>
    </SectionWrapper>
  );
};

const inferHeroHighlights = (section: SiteSection, site: SiteDocument) => {
  const content = section.content as any;
  const configured = normalizeList(
    Array.isArray(content.highlights) ? content.highlights : [],
    []
  ).slice(0, 3);
  if (configured.length) return configured;

  const industryKey = resolveSiteRenderDNA(site).industryKey;
  switch (industryKey) {
    case "barbershop":
      return ["Skin fades", "Beard detail", "Hot towel finish"];
    case "restaurant":
      return ["Signature dishes", "Late table energy", "Reservations"];
    case "dental_clinic":
      return ["Clear treatment steps", "Calm appointments", "Modern clinic"];
    case "real_estate":
      return ["Buyer guidance", "Seller strategy", "Area insight"];
    default:
      return [];
  }
};

const inferAboutHighlights = (site: SiteDocument) => {
  const industryKey = resolveSiteRenderDNA(site).industryKey;
  switch (industryKey) {
    case "barbershop":
      return [
        { title: "Pace", body: "Appointments are built to feel focused, not rushed." },
        { title: "Standard", body: "Regulars know what a sharp finish looks like here." }
      ];
    case "restaurant":
      return [
        { title: "Atmosphere", body: "The room, lighting, and pacing are part of the draw." },
        { title: "House voice", body: "The menu feels like one kitchen with a point of view." }
      ];
    case "dental_clinic":
      return [
        { title: "Clarity", body: "Patients are told what matters now and what can wait." },
        { title: "Reassurance", body: "The clinic lowers hesitation before treatment begins." }
      ];
    case "real_estate":
      return [
        { title: "Market read", body: "Advice reflects the area, not generic portal copy." },
        { title: "Lead quality", body: "The page is structured to attract more serious inquiries." }
      ];
    default:
      return [];
  }
};

const HeroE: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const image = getImageBySlot(section, "hero");
  const highlights = inferHeroHighlights(section, ctx.site);
  const dna = resolveSiteRenderDNA(ctx.site);
  const inverse = ["bold_urban", "premium_fine_dining", "luxury_property_advisory"].includes(dna.archetypeKey ?? "");

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.96fr]">
        <div className={`${renderSurfaceClass(ctx.site, "feature")} p-8 md:p-10 lg:p-12`}>
          <div className="space-y-6">
            <ContentText
              section={section}
              contentKey="kicker"
              as="p"
              className={renderEyebrowClass(ctx.site, inverse ? "inverse" : "default")}
            >
              {content.kicker ?? "Book with clarity"}
            </ContentText>
            <ContentText
              section={section}
              contentKey="headline"
              as="h1"
              className={`text-4xl font-semibold md:text-5xl ${inverse ? "text-white" : "text-[color:var(--site-text)]"}`}
            >
              {content.headline}
            </ContentText>
            <ContentText
              section={section}
              contentKey="subheadline"
              as="p"
              className={`max-w-2xl text-base ${inverse ? "text-white/78" : "text-[color:var(--site-muted)]"}`}
            >
              {content.subheadline}
            </ContentText>
            {highlights.length ? (
              <div className="flex flex-wrap gap-3">
                {highlights.map((item, index) => (
                  <span
                    key={`${item}-${index}`}
                    className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] ${
                      inverse ? "border border-white/14 bg-white/6 text-white/74" : "border border-[color:var(--site-border)] text-[color:var(--site-muted)]"
                    }`}
                  >
                    <ContentText section={section} contentKey={`highlights.${index}`} as="span">
                      {item}
                    </ContentText>
                  </span>
                ))}
              </div>
            ) : null}
            <a
              href={content.ctaHref}
              className={renderButtonClass(ctx.site, section.style.buttonStyle)}
              onClick={getCtaHandler(content.ctaHref, ctx)}
            >
              <ContentText section={section} contentKey="ctaLabel" as="span">
                {content.ctaLabel}
              </ContentText>
            </a>
          </div>
        </div>
        <div className="grid gap-4">
          {image?.src ? (
            <div className={`overflow-hidden ${renderSurfaceClass(ctx.site, "quiet")} p-2`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt ?? "Hero"}
                width={image.width ?? 1600}
                height={image.height ?? 1000}
                className={renderImageClass(ctx.site, "hero")}
              />
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {highlights.slice(0, 2).map((item, index) => (
              <div key={`${item}-${index}`} className={`${renderSurfaceClass(ctx.site)} p-5`}>
                <p className={renderEyebrowClass(ctx.site)}>Focus</p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--site-text)]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

const HeroF: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const image = getImageBySlot(section, "hero");
  const highlights = inferHeroHighlights(section, ctx.site);
  const renderDNA = resolveSiteRenderDNA(ctx.site);
  const lightGlass = renderDNA.archetypeKey === "cozy_family_dining";

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-none px-0" className="overflow-hidden">
      <div className="relative min-h-[62vh] md:min-h-[72vh]">
        {image?.src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt ?? "Hero"}
              width={image.width ?? 1800}
              height={image.height ?? 1200}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,17,17,0.28),rgba(17,17,17,0.68))]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--site-primary),var(--site-accent),#111111)]" />
        )}
        <div className="relative mx-auto flex min-h-[62vh] w-full max-w-7xl flex-col justify-center gap-8 px-5 py-16 text-center md:min-h-[72vh] md:px-6 md:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            <ContentText section={section} contentKey="kicker" as="p" className={renderEyebrowClass(ctx.site, "inverse")}>
              {content.kicker ?? "Reservations"}
            </ContentText>
            <ContentText section={section} contentKey="headline" as="h1" className="text-[clamp(2.5rem,11vw,5.25rem)] font-semibold leading-[0.92] text-white">
              {content.headline}
            </ContentText>
            <ContentText section={section} contentKey="subheadline" as="p" className="mx-auto max-w-2xl text-base text-white/82 md:text-lg">
              {content.subheadline}
            </ContentText>
          </div>
          <div className={`${renderSurfaceClass(ctx.site, "glass")} mx-auto grid w-full max-w-5xl gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center md:gap-4 md:p-6`}>
            {highlights.slice(0, 3).map((item, index) => (
              <div
                key={`${item}-${index}`}
                className={`rounded-[1.35rem] border px-4 py-4 text-left ${
                  lightGlass ? "border-[rgba(140,84,28,0.08)] bg-white/72 text-[color:var(--site-text)]" : "border-white/10 bg-white/6 text-white/82"
                }`}
              >
                <p className={`text-[11px] uppercase tracking-[0.2em] ${lightGlass ? "text-[color:var(--site-muted)]" : "text-white/56"}`}>Tonight</p>
                <p className="mt-2 text-sm font-medium">
                  <ContentText section={section} contentKey={`highlights.${index}`} as="span">
                    {item}
                  </ContentText>
                </p>
              </div>
            ))}
            <a
              href={content.ctaHref}
              className={renderButtonClass(ctx.site, section.style.buttonStyle)}
              onClick={getCtaHandler(content.ctaHref, ctx)}
            >
              <ContentText section={section} contentKey="ctaLabel" as="span">
                {content.ctaLabel}
              </ContentText>
            </a>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

const HeroG: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const image = getImageBySlot(section, "hero");
  const highlights = inferHeroHighlights(section, ctx.site);

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-10">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-end">
        <div className="space-y-6 pb-2">
          <ContentText section={section} contentKey="kicker" as="p" className={renderEyebrowClass(ctx.site)}>
            {content.kicker ?? "Property guidance"}
          </ContentText>
          <ContentText
            section={section}
            contentKey="headline"
            as="h1"
            className="max-w-2xl text-4xl font-semibold text-[color:var(--site-text)] md:text-5xl"
          >
            {content.headline}
          </ContentText>
          <ContentText
            section={section}
            contentKey="subheadline"
            as="p"
            className="max-w-2xl text-base text-[color:var(--site-muted)]"
          >
            {content.subheadline}
          </ContentText>
          <div className="flex flex-wrap gap-3">
            {highlights.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="rounded-full border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--site-muted)]"
              >
                <ContentText section={section} contentKey={`highlights.${index}`} as="span">
                  {item}
                </ContentText>
              </span>
            ))}
          </div>
          <a
            href={content.ctaHref}
            className={renderButtonClass(ctx.site, section.style.buttonStyle)}
            onClick={getCtaHandler(content.ctaHref, ctx)}
          >
            <ContentText section={section} contentKey="ctaLabel" as="span">
              {content.ctaLabel}
            </ContentText>
          </a>
        </div>
        <div className="relative overflow-hidden rounded-[2rem] border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-2 shadow-[0_24px_70px_rgba(20,20,20,0.1)]">
          {image?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              alt={image.alt ?? "Hero"}
              width={image.width ?? 1600}
              height={image.height ?? 1000}
              className={`${renderImageClass(ctx.site, "hero")} min-h-[420px]`}
            />
          ) : (
            <div className="min-h-[420px] rounded-[1.7rem] bg-[linear-gradient(160deg,var(--site-primary),var(--site-accent))]" />
          )}
          <div className="absolute bottom-6 left-6 right-6 grid gap-3 md:grid-cols-3">
            {highlights.slice(0, 3).map((item, index) => (
              <div key={`${item}-${index}`} className={`${renderSurfaceClass(ctx.site, "feature")} p-4`}>
                <p className={renderEyebrowClass(ctx.site, "inverse")}>Focus</p>
                <p className="mt-2 text-sm font-medium text-white">
                  <ContentText section={section} contentKey={`highlights.${index}`} as="span">
                    {item}
                  </ContentText>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

const HeroH: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const image = getImageBySlot(section, "hero");
  const highlights = inferHeroHighlights(section, ctx.site);

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="rounded-[2rem] bg-[#111111] p-8 text-white shadow-[0_35px_90px_rgba(0,0,0,0.34)] md:p-10">
          <div className="space-y-6">
            <ContentText section={section} contentKey="kicker" as="p" className={renderEyebrowClass(ctx.site, "inverse")}>
              {content.kicker ?? "Sharp cuts"}
            </ContentText>
            <ContentText section={section} contentKey="headline" as="h1" className="text-4xl font-semibold text-white md:text-5xl">
              {content.headline}
            </ContentText>
            <ContentText section={section} contentKey="subheadline" as="p" className="text-base text-white/76">
              {content.subheadline}
            </ContentText>
            <div className="space-y-3">
              {highlights.map((item, index) => (
                <div key={`${item}-${index}`} className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">
                  <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--site-secondary)]" />
                  <ContentText section={section} contentKey={`highlights.${index}`} as="span">
                    {item}
                  </ContentText>
                </div>
              ))}
            </div>
            <a
              href={content.ctaHref}
              className={renderButtonClass(ctx.site, "solid")}
              onClick={getCtaHandler(content.ctaHref, ctx)}
            >
              <ContentText section={section} contentKey="ctaLabel" as="span">
                {content.ctaLabel}
              </ContentText>
            </a>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[2rem] border border-[color:var(--site-border)] bg-[color:var(--site-surface)] shadow-[0_30px_80px_rgba(17,17,17,0.12)]">
          {image?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              alt={image.alt ?? "Hero"}
              width={image.width ?? 1600}
              height={image.height ?? 1000}
              className={`${renderImageClass(ctx.site, "hero")} min-h-[520px]`}
            />
          ) : (
            <div className="min-h-[520px] bg-[linear-gradient(140deg,var(--site-primary),var(--site-accent))]" />
          )}
          <div className="absolute inset-x-0 bottom-0 grid gap-px bg-white/10 backdrop-blur xl:grid-cols-3">
            {highlights.slice(0, 3).map((item, index) => (
              <div key={`${item}-${index}`} className="bg-black/52 px-5 py-4 text-white">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/56">Signature</p>
                <p className="mt-2 text-sm font-medium">
                  <ContentText section={section} contentKey={`highlights.${index}`} as="span">
                    {item}
                  </ContentText>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

const ServicesD: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = normalizeList(content.items, []).slice(0, 4);
  if (!items.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.58fr_1.42fr]">
        <div className="space-y-4">
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText section={section} contentKey="subtitle" as="p" className="text-sm text-[color:var(--site-muted)]">
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item: any, index: number) => (
            <div
              key={`${item.title}-${index}`}
              className={`${renderSurfaceClass(ctx.site, index === 0 ? "feature" : "default")} p-6 ${index === 0 ? "md:col-span-2" : ""}`}
            >
              <p className={renderEyebrowClass(ctx.site, index === 0 ? "inverse" : "default")}>{String(index + 1).padStart(2, "0")}</p>
              <ContentText
                section={section}
                contentKey={`items.${index}.title`}
                as="h3"
                className={`mt-3 text-2xl font-semibold ${index === 0 ? "text-white" : "text-[color:var(--site-text)]"}`}
              >
                {item.title}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`items.${index}.body`}
                as="p"
                className={`mt-3 text-sm ${index === 0 ? "text-white/76" : "text-[color:var(--site-muted)]"}`}
              >
                {item.body}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const ServicesE: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = normalizeList(content.items, []).slice(0, 6);
  if (!items.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-10">
      <div className="space-y-8">
        <div className="max-w-2xl space-y-3">
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText section={section} contentKey="subtitle" as="p" className="text-sm text-[color:var(--site-muted)]">
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item: any, index: number) => (
            <div key={`${item.title}-${index}`} className="border-t border-[color:var(--site-border)] pt-5">
              <ContentText section={section} contentKey={`items.${index}.title`} as="h3" className="text-xl font-semibold text-[color:var(--site-text)]">
                {item.title}
              </ContentText>
              <ContentText section={section} contentKey={`items.${index}.body`} as="p" className="mt-3 text-sm text-[color:var(--site-muted)]">
                {item.body}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const ServicesF: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = normalizeList(content.items, []).slice(0, 4);
  if (!items.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="space-y-4">
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText section={section} contentKey="subtitle" as="p" className="text-sm text-[color:var(--site-muted)]">
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="space-y-4">
          {items.map((item: any, index: number) => (
            <div key={`${item.title}-${index}`} className={`${renderSurfaceClass(ctx.site)} flex gap-4 p-5`}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--site-secondary)]/25 text-sm font-semibold text-[color:var(--site-primary)]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div>
                <ContentText section={section} contentKey={`items.${index}.title`} as="h3" className="text-lg font-semibold text-[color:var(--site-text)]">
                  {item.title}
                </ContentText>
                <ContentText section={section} contentKey={`items.${index}.body`} as="p" className="mt-2 text-sm text-[color:var(--site-muted)]">
                  {item.body}
                </ContentText>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const ServicesG: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = normalizeList(content.items, []).slice(0, 4);
  if (!items.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <ContentText section={section} contentKey="title" as="h2" className="max-w-2xl text-3xl font-semibold text-[color:var(--site-text)]">
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText section={section} contentKey="subtitle" as="p" className="max-w-xl text-sm text-[color:var(--site-muted)]">
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {items.map((item: any, index: number) => (
            <div key={`${item.title}-${index}`} className={`${renderSurfaceClass(ctx.site, index === 0 ? "feature" : "default")} p-6`}>
              <p className={renderEyebrowClass(ctx.site, index === 0 ? "inverse" : "default")}>Advisory {index + 1}</p>
              <ContentText
                section={section}
                contentKey={`items.${index}.title`}
                as="h3"
                className={`mt-3 text-xl font-semibold ${index === 0 ? "text-white" : "text-[color:var(--site-text)]"}`}
              >
                {item.title}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`items.${index}.body`}
                as="p"
                className={`mt-3 text-sm ${index === 0 ? "text-white/76" : "text-[color:var(--site-muted)]"}`}
              >
                {item.body}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const AboutD: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const highlights = inferAboutHighlights(ctx.site);
  const dna = resolveSiteRenderDNA(ctx.site);
  const inverse = ["bold_urban", "premium_fine_dining", "luxury_property_advisory"].includes(dna.archetypeKey ?? "");

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8">
      <div className={`${renderSurfaceClass(ctx.site, "feature")} grid gap-8 p-8 md:p-10 lg:grid-cols-[1fr_0.85fr]`}>
        <div className="space-y-4">
          <ContentText section={section} contentKey="title" as="h2" className={`text-3xl font-semibold ${inverse ? "text-white" : "text-[color:var(--site-text)]"}`}>
            {content.title}
          </ContentText>
          <ContentText section={section} contentKey="body" as="p" className={`text-sm ${inverse ? "text-white/76" : "text-[color:var(--site-muted)]"}`}>
            {content.body}
          </ContentText>
        </div>
        <div className="grid gap-4">
          {highlights.map((item, index) => (
            <div key={`${item.title}-${index}`} className={`rounded-[1.4rem] border p-5 ${inverse ? "border-white/10 bg-white/6" : "border-[color:var(--site-border)] bg-white/70"}`}>
              <p className={renderEyebrowClass(ctx.site, inverse ? "inverse" : "default")}>{item.title}</p>
              <p className={`mt-3 text-sm ${inverse ? "text-white/76" : "text-[color:var(--site-muted)]"}`}>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const AboutE: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const highlights = inferAboutHighlights(ctx.site);

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-10">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="space-y-5">
          <ContentText section={section} contentKey="title" as="h2" className="text-4xl font-semibold text-[color:var(--site-text)]">
            {content.title}
          </ContentText>
          <ContentText section={section} contentKey="body" as="p" className="max-w-3xl text-base text-[color:var(--site-muted)]">
            {content.body}
          </ContentText>
        </div>
        <div className="space-y-4">
          {highlights.map((item, index) => (
            <div key={`${item.title}-${index}`} className={`${renderSurfaceClass(ctx.site)} p-5`}>
              <p className={renderEyebrowClass(ctx.site)}>{item.title}</p>
              <p className="mt-3 text-sm text-[color:var(--site-muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const AboutF: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const highlights = inferAboutHighlights(ctx.site);

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className={`${renderSurfaceClass(ctx.site)} p-7 md:p-8`}>
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
            {content.title}
          </ContentText>
          <ContentText section={section} contentKey="body" as="p" className="mt-4 text-sm text-[color:var(--site-muted)]">
            {content.body}
          </ContentText>
        </div>
        <div className="grid gap-4">
          {highlights.map((item, index) => (
            <div key={`${item.title}-${index}`} className={`${renderSurfaceClass(ctx.site, "feature")} p-5`}>
              <p className={renderEyebrowClass(ctx.site, "inverse")}>{item.title}</p>
              <p className="mt-3 text-sm text-white/78">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const GalleryD: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const images = normalizeList(section.images, []).filter((image: any) => Boolean(image?.src));
  if (!images.length) return <></>;
  const [lead, ...rest] = images;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="space-y-6">
        <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
          {content.title}
        </ContentText>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className={`${renderSurfaceClass(ctx.site, "quiet")} p-2`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lead.src}
              alt={lead.alt ?? "Gallery"}
              width={lead.width ?? 1600}
              height={lead.height ?? 1100}
              className={`${renderImageClass(ctx.site, "gallery")} min-h-[520px]`}
            />
          </div>
          <div className="grid gap-4">
            {rest.slice(0, 2).map((image: any, index: number) => (
              <div key={`${image.src}-${index}`} className={`${renderSurfaceClass(ctx.site)} p-2`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.src}
                  alt={image.alt ?? "Gallery"}
                  width={image.width ?? 1200}
                  height={image.height ?? 900}
                  className={`${renderImageClass(ctx.site, "gallery")} min-h-[248px]`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

const GalleryE: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const images = normalizeList(section.images, []).filter((image: any) => Boolean(image?.src));
  if (!images.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-10">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText section={section} contentKey="subtitle" as="p" className="max-w-xl text-sm text-[color:var(--site-muted)]">
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="grid auto-rows-[180px] gap-4 md:grid-cols-4">
          {images.map((image: any, index: number) => (
            <div
              key={`${image.src}-${index}`}
              className={`${renderSurfaceClass(ctx.site)} p-2 ${
                index === 0 ? "md:col-span-2 md:row-span-2" : index === 1 ? "md:row-span-2" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt ?? "Gallery"}
                width={image.width ?? 1200}
                height={image.height ?? 900}
                className={`${renderImageClass(ctx.site, "gallery")} h-full min-h-[160px]`}
              />
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const TestimonialsC: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = Array.isArray(content.items) ? content.items : [];
  if (!items.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="space-y-4">
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText section={section} contentKey="subtitle" as="p" className="text-sm text-[color:var(--site-muted)]">
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="space-y-4">
          {items.map((item: any, index: number) => (
            <div key={`${item.name}-${index}`} className={`${renderSurfaceClass(ctx.site)} p-5`}>
              <p className={renderEyebrowClass(ctx.site)}>{item.name}</p>
              <ContentText section={section} contentKey={`items.${index}.quote`} as="p" className="mt-3 text-base text-[color:var(--site-text)]">
                {item.quote}
              </ContentText>
              <ContentText section={section} contentKey={`items.${index}.role`} as="p" className="mt-3 text-xs uppercase tracking-[0.18em] text-[color:var(--site-muted)]">
                {item.role}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const TestimonialsD: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = Array.isArray(content.items) ? content.items : [];
  if (!items.length) return <></>;
  const lead = items[0];

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className={`${renderSurfaceClass(ctx.site, "feature")} p-8 md:p-10`}>
          <p className={renderEyebrowClass(ctx.site, "inverse")}>{content.title}</p>
          <p className="mt-5 text-2xl font-semibold leading-tight text-white md:text-3xl">
            <ContentText section={section} contentKey="items.0.quote" as="span">
              {lead.quote}
            </ContentText>
          </p>
          <p className="mt-6 text-sm uppercase tracking-[0.18em] text-white/62">{lead.name}</p>
          <p className="mt-1 text-sm text-white/72">{lead.role}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {items.slice(1).map((item: any, index: number) => (
            <div key={`${item.name}-${index}`} className={`${renderSurfaceClass(ctx.site)} p-5`}>
              <p className={renderEyebrowClass(ctx.site)}>{item.name}</p>
              <ContentText section={section} contentKey={`items.${index + 1}.quote`} as="p" className="mt-3 text-sm text-[color:var(--site-text)]">
                {item.quote}
              </ContentText>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[color:var(--site-muted)]">{item.role}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const TestimonialsE: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = Array.isArray(content.items) ? content.items : [];
  if (!items.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8">
      <div className={`${renderSurfaceClass(ctx.site, "feature")} space-y-6 p-8 md:p-10`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-white">
            {content.title}
          </ContentText>
          <p className={`${renderMetricClass(ctx.site)} text-white`}>Feedback signal</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item: any, index: number) => (
            <div key={`${item.name}-${index}`} className="rounded-[1.4rem] border border-white/10 bg-white/6 p-5">
              <p className={renderEyebrowClass(ctx.site, "inverse")}>{item.name}</p>
              <ContentText section={section} contentKey={`items.${index}.quote`} as="p" className="mt-3 text-sm text-white/78">
                {item.quote}
              </ContentText>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/58">{item.role}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const TestimonialsF: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = Array.isArray(content.items) ? content.items : [];
  if (!items.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <div className={`${renderSurfaceClass(ctx.site, "feature")} p-7`}>
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-white">
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText section={section} contentKey="subtitle" as="p" className="mt-3 text-sm text-white/76">
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item: any, index: number) => (
            <div key={`${item.name}-${index}`} className={`${renderSurfaceClass(ctx.site)} p-5`}>
              <p className={renderEyebrowClass(ctx.site)}>{item.role}</p>
              <ContentText section={section} contentKey={`items.${index}.quote`} as="p" className="mt-3 text-base text-[color:var(--site-text)]">
                {item.quote}
              </ContentText>
              <p className="mt-4 text-sm font-semibold text-[color:var(--site-text)]">{item.name}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const PricingC: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const plans = normalizeList<any>(content.plans, []);
  if (!plans.length) return <></>;
  const [lead, ...rest] = plans as any[];

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="space-y-8">
        <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
          {content.title}
        </ContentText>
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className={`${renderSurfaceClass(ctx.site, "feature")} p-8`}>
            <p className={renderEyebrowClass(ctx.site, "inverse")}>{lead.name}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{lead.price}</p>
            <p className="mt-4 text-sm text-white/78">{lead.description}</p>
            {lead.features?.length ? (
              <ul className="mt-6 space-y-3 text-sm text-white/76">
                {lead.features.map((feature: string, featureIndex: number) => (
                  <li key={`${lead.name}-${featureIndex}`} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[color:var(--site-secondary)]" />
                    <ContentText section={section} contentKey={`plans.0.features.${featureIndex}`} as="span">
                      {feature}
                    </ContentText>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="space-y-4">
            {rest.map((plan: any, index: number) => (
              <div key={`${plan.name}-${index}`} className={`${renderSurfaceClass(ctx.site)} flex flex-wrap items-start justify-between gap-5 p-5`}>
                <div>
                  <ContentText section={section} contentKey={`plans.${index + 1}.name`} as="h3" className="text-lg font-semibold text-[color:var(--site-text)]">
                    {plan.name}
                  </ContentText>
                  <ContentText section={section} contentKey={`plans.${index + 1}.description`} as="p" className="mt-2 text-sm text-[color:var(--site-muted)]">
                    {plan.description}
                  </ContentText>
                </div>
                <ContentText section={section} contentKey={`plans.${index + 1}.price`} as="p" className="text-lg font-semibold text-[color:var(--site-primary)]">
                  {plan.price}
                </ContentText>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

const PricingD: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const plans = normalizeList(content.plans, []);
  const images = normalizeList(section.images, []).filter((image: any) => Boolean(image?.src));
  if (!plans.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-10">
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
            {content.title}
          </ContentText>
          {content.subtitle ? (
            <ContentText section={section} contentKey="subtitle" as="p" className="max-w-xl text-sm text-[color:var(--site-muted)]">
              {content.subtitle}
            </ContentText>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan: any, index: number) => {
            const image = images[index];
            const title = plan.name || image?.alt || `Feature ${index + 1}`;
            const description = plan.description || content.subtitle || "";
            return (
              <div key={`${plan.name}-${index}`} className={`${renderSurfaceClass(ctx.site)} overflow-hidden p-2`}>
                {image?.src ? (
                  <div className="relative overflow-hidden rounded-[1.2rem]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.src}
                      alt={image.alt ?? title}
                      width={image.width ?? 1200}
                      height={image.height ?? 900}
                      className={`${renderImageClass(ctx.site, "gallery")} h-52`}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(17,17,17,0.02),rgba(17,17,17,0.74))] px-4 py-4 text-left">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/68">{plan.price || "Signature pick"}</p>
                      <p className="mt-2 text-xl font-semibold text-white">{title}</p>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-3 p-4">
                  {!image?.src ? <p className={renderEyebrowClass(ctx.site)}>{plan.price}</p> : null}
                  {!image?.src ? (
                    <ContentText section={section} contentKey={`plans.${index}.name`} as="h3" className="text-xl font-semibold text-[color:var(--site-text)]">
                      {title}
                    </ContentText>
                  ) : null}
                  {description ? (
                    <ContentText section={section} contentKey={`plans.${index}.description`} as="p" className="text-sm leading-6 text-[color:var(--site-muted)]">
                      {description}
                    </ContentText>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
};

const PricingE: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const plans = normalizeList(content.plans, []);
  const images = normalizeList(section.images, []).filter((image: any) => Boolean(image?.src));
  if (!plans.length) return <></>;

  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="space-y-8">
        <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
          {content.title}
        </ContentText>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan: any, index: number) => {
            const image = images[index];
            return (
              <div key={`${plan.name}-${index}`} className={`${renderSurfaceClass(ctx.site, index === 0 ? "feature" : "default")} overflow-hidden p-2`}>
                {image?.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.src}
                    alt={image.alt ?? plan.name}
                    width={image.width ?? 1200}
                    height={image.height ?? 900}
                    className={`${renderImageClass(ctx.site, "gallery")} h-56`}
                  />
                ) : null}
                <div className="p-4">
                  <p className={renderEyebrowClass(ctx.site, index === 0 ? "inverse" : "default")}>{plan.price}</p>
                  <ContentText
                    section={section}
                    contentKey={`plans.${index}.name`}
                    as="h3"
                    className={`mt-2 text-xl font-semibold ${index === 0 ? "text-white" : "text-[color:var(--site-text)]"}`}
                  >
                    {plan.name}
                  </ContentText>
                  <ContentText
                    section={section}
                    contentKey={`plans.${index}.description`}
                    as="p"
                    className={`mt-3 text-sm ${index === 0 ? "text-white/76" : "text-[color:var(--site-muted)]"}`}
                  >
                    {plan.description}
                  </ContentText>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
};

const CtaD: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8">
      <div className={`${renderSurfaceClass(ctx.site, "feature")} grid gap-6 p-8 md:p-10 lg:grid-cols-[1fr_auto] lg:items-center`}>
        <div className="space-y-3">
          <p className={renderEyebrowClass(ctx.site, "inverse")}>{content.kicker ?? "Book now"}</p>
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-white">
            {content.title}
          </ContentText>
          <ContentText section={section} contentKey="body" as="p" className="max-w-2xl text-sm text-white/76">
            {content.body}
          </ContentText>
        </div>
        <a href={content.ctaHref ?? "#contact"} className={renderButtonClass(ctx.site, "solid")} onClick={getCtaHandler(content.ctaHref ?? "#contact", ctx)}>
          <ContentText section={section} contentKey="ctaLabel" as="span">
            {content.ctaLabel}
          </ContentText>
        </a>
      </div>
    </SectionWrapper>
  );
};

const CtaE: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div className={`${renderSurfaceClass(ctx.site)} p-7`}>
          <p className={renderEyebrowClass(ctx.site)}>{content.kicker ?? "Next step"}</p>
          <ContentText section={section} contentKey="title" as="h2" className="mt-3 text-3xl font-semibold text-[color:var(--site-text)]">
            {content.title}
          </ContentText>
        </div>
        <div className={`${renderSurfaceClass(ctx.site, "feature")} flex flex-col justify-between gap-5 p-7`}>
          <ContentText section={section} contentKey="body" as="p" className="text-sm text-white/78">
            {content.body}
          </ContentText>
          <a href={content.ctaHref ?? "#contact"} className={renderButtonClass(ctx.site, "solid")} onClick={getCtaHandler(content.ctaHref ?? "#contact", ctx)}>
            <ContentText section={section} contentKey="ctaLabel" as="span">
              {content.ctaLabel}
            </ContentText>
          </a>
        </div>
      </div>
    </SectionWrapper>
  );
};

const CtaF: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className={`${renderSurfaceClass(ctx.site, "feature")} grid gap-6 p-8 md:p-10 lg:grid-cols-[1fr_0.9fr]`}>
        <div className="space-y-4">
          <p className={renderEyebrowClass(ctx.site, "inverse")}>{content.kicker ?? "Inquiry"}</p>
          <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-white">
            {content.title}
          </ContentText>
          <ContentText section={section} contentKey="body" as="p" className="max-w-2xl text-sm text-white/76">
            {content.body}
          </ContentText>
        </div>
        <div className="flex items-center justify-start lg:justify-end">
          <a href={content.ctaHref ?? "#contact"} className={renderButtonClass(ctx.site, "outline")} onClick={getCtaHandler(content.ctaHref ?? "#contact", ctx)}>
            <ContentText section={section} contentKey="ctaLabel" as="span">
              {content.ctaLabel}
            </ContentText>
          </a>
        </div>
      </div>
    </SectionWrapper>
  );
};

const FaqC: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const items = normalizeList(content.items, []);
  if (!items.length) return <></>;
  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8">
      <div className="space-y-8">
        <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
          {content.title}
        </ContentText>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item: any, index: number) => (
            <div key={`${item.question}-${index}`} className={`${renderSurfaceClass(ctx.site)} p-5`}>
              <p className={renderEyebrowClass(ctx.site)}>{String(index + 1).padStart(2, "0")}</p>
              <ContentText section={section} contentKey={`items.${index}.question`} as="p" className="mt-3 text-lg font-semibold text-[color:var(--site-text)]">
                {item.question}
              </ContentText>
              <ContentText section={section} contentKey={`items.${index}.answer`} as="p" className="mt-3 text-sm text-[color:var(--site-muted)]">
                {item.answer}
              </ContentText>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const ContactD: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const siteSlug = resolveSiteSlug();
  const mode = resolvePreviewMode() ? "preview" : "live";
  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div className={`${renderSurfaceClass(ctx.site, "feature")} p-7`}>
          <p className={renderEyebrowClass(ctx.site, "inverse")}>{content.title}</p>
          <ContentText section={section} contentKey="body" as="p" className="mt-4 text-sm text-white/76">
            {content.body}
          </ContentText>
          <div className="mt-6 space-y-3 text-sm text-white/72">
            {content.phone ? <p>{content.phone}</p> : null}
            {content.email ? <p>{content.email}</p> : null}
            {content.address ? <p>{content.address}</p> : null}
          </div>
        </div>
        <div className={`${renderSurfaceClass(ctx.site)} p-6`}>
          <ContactForm mode={mode} siteSlug={siteSlug} analytics={ctx.analytics ?? undefined} />
        </div>
      </div>
    </SectionWrapper>
  );
};

const ContactE: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const renderDNA = resolveSiteRenderDNA(ctx.site);
  const siteSlug = resolveSiteSlug();
  const mode = resolvePreviewMode() ? "preview" : "live";
  if (renderDNA.industryKey === "restaurant") {
    return (
      <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className={`${renderSurfaceClass(ctx.site)} p-7 md:p-8`}>
            <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
              {content.title}
            </ContentText>
            <ContentText section={section} contentKey="body" as="p" className="mt-4 text-sm leading-7 text-[color:var(--site-muted)]">
              {content.body}
            </ContentText>
          </div>
          <div className="grid gap-4">
            {content.address ? (
              <div className={`${renderSurfaceClass(ctx.site, "feature")} p-5`}>
                <p className={renderEyebrowClass(ctx.site, "inverse")}>Address</p>
                <p className="mt-3 text-base text-white/82">{content.address}</p>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {content.phone ? (
                <div className={`${renderSurfaceClass(ctx.site)} p-5`}>
                  <p className={renderEyebrowClass(ctx.site)}>Phone</p>
                  <p className="mt-3 text-sm text-[color:var(--site-text)]">{content.phone}</p>
                </div>
              ) : null}
              {content.email ? (
                <div className={`${renderSurfaceClass(ctx.site)} p-5`}>
                  <p className={renderEyebrowClass(ctx.site)}>Email</p>
                  <p className="mt-3 text-sm text-[color:var(--site-text)]">{content.email}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SectionWrapper>
    );
  }
  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-6xl px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="grid gap-4">
          <div className={`${renderSurfaceClass(ctx.site)} p-6`}>
            <ContentText section={section} contentKey="title" as="h2" className="text-3xl font-semibold text-[color:var(--site-text)]">
              {content.title}
            </ContentText>
            <ContentText section={section} contentKey="body" as="p" className="mt-3 text-sm text-[color:var(--site-muted)]">
              {content.body}
            </ContentText>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {content.phone ? <div className={`${renderSurfaceClass(ctx.site)} p-4 text-sm text-[color:var(--site-text)]`}>{content.phone}</div> : null}
            {content.email ? <div className={`${renderSurfaceClass(ctx.site)} p-4 text-sm text-[color:var(--site-text)]`}>{content.email}</div> : null}
            {content.address ? <div className={`${renderSurfaceClass(ctx.site)} p-4 text-sm text-[color:var(--site-text)]`}>{content.address}</div> : null}
          </div>
        </div>
        <div className={`${renderSurfaceClass(ctx.site, "feature")} p-6`}>
          <ContactForm mode={mode} siteSlug={siteSlug} analytics={ctx.analytics ?? undefined} />
        </div>
      </div>
    </SectionWrapper>
  );
};

const ContactF: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const siteSlug = resolveSiteSlug();
  const mode = resolvePreviewMode() ? "preview" : "live";
  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className={`${renderSurfaceClass(ctx.site, "feature")} p-7`}>
          <p className={renderEyebrowClass(ctx.site, "inverse")}>{content.title}</p>
          <ContentText section={section} contentKey="body" as="p" className="mt-4 text-sm text-white/76">
            {content.body}
          </ContentText>
          <div className="mt-6 grid gap-3">
            {content.phone ? <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4 text-sm text-white/76">{content.phone}</div> : null}
            {content.email ? <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4 text-sm text-white/76">{content.email}</div> : null}
            {content.address ? <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4 text-sm text-white/76">{content.address}</div> : null}
          </div>
        </div>
        <div className={`${renderSurfaceClass(ctx.site)} p-6`}>
          <ContactForm mode={mode} siteSlug={siteSlug} analytics={ctx.analytics ?? undefined} />
        </div>
      </div>
    </SectionWrapper>
  );
};

const ReservationC: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const siteSlug = resolveSiteSlug();
  const mode = resolvePreviewMode() ? "preview" : "live";
  return (
    <SectionWrapper section={section} ctx={ctx} containerClassName="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
        <div className={`${renderSurfaceClass(ctx.site, "feature")} p-8 md:p-10`}>
          <p className={renderEyebrowClass(ctx.site, "inverse")}>{content.kicker ?? "Reservations"}</p>
          <ContentText section={section} contentKey="title" as="h2" className="mt-3 text-3xl font-semibold text-white">
            {content.title}
          </ContentText>
          <ContentText section={section} contentKey="body" as="p" className="mt-4 text-sm text-white/78">
            {content.body}
          </ContentText>
        </div>
        <div className={`${renderSurfaceClass(ctx.site)} p-6`}>
          <ReservationForm mode={mode} siteSlug={siteSlug} analytics={ctx.analytics ?? undefined} />
        </div>
      </div>
    </SectionWrapper>
  );
};

const FooterC: SectionRenderer = ({ section }) => {
  const content = section.content as any;
  return (
    <footer
      id={section.id}
      data-section-id={section.id}
      data-node-id={section.id}
      className="border-t border-[color:var(--site-border)] bg-[#111111] text-white"
      style={getSectionVars(section)}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[1fr_auto] lg:px-8">
        <ContentText section={section} contentKey="text" as="p" className="text-sm text-white/66">
          {content.text}
        </ContentText>
        <span className="text-[11px] uppercase tracking-[0.22em] text-white/50">Powered by SiroundChat</span>
      </div>
    </footer>
  );
};

const FooterA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <footer
      id={section.id}
      data-section-id={section.id}
      data-node-id={section.id}
      className="border-t border-[color:var(--site-border)] bg-[color:var(--site-surface)]"
      style={getSectionVars(section)}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-[color:var(--site-muted)]">
        <ContentText section={section} contentKey="text" as="span">
          {content.text}
        </ContentText>
        <span>Powered by SiroundChat</span>
      </div>
    </footer>
  );
};

const FooterB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const links = normalizeList(content.links, [
    { label: "Services", href: "#services" },
    { label: "About", href: "#about" },
    { label: "Contact", href: "#contact" }
  ]);

  return (
    <footer
      id={section.id}
      data-section-id={section.id}
      data-node-id={section.id}
      className="border-t border-[color:var(--site-border)] bg-[color:var(--site-surface)]"
      style={getSectionVars(section)}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <ContentText section={section} contentKey="text" as="p" className="text-sm text-[color:var(--site-muted)]">
            {content.text}
          </ContentText>
        </div>
        <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-[color:var(--site-muted)]">
          {links.map((link: any, index: number) => (
            <a key={`${link.label}-${index}`} href={link.href} className="hover:text-[color:var(--site-text)]">
              <ContentText section={section} contentKey={`links.${index}.label`} as="span">
                {link.label}
              </ContentText>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

const NewsletterA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="mx-auto max-w-3xl space-y-4">
        <ContentText
          section={section}
          contentKey="title"
          as="h2"
          className="text-2xl font-semibold text-[color:var(--site-text)]"
        >
          {content.title}
        </ContentText>
        <ContentText section={section} contentKey="body" as="p" className="text-[color:var(--site-muted)]">
          {content.body}
        </ContentText>
        <form className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            placeholder="you@email.com"
            className="h-11 flex-1 rounded-full border border-[color:var(--site-border)] bg-white/80 px-4 text-sm text-neutral-900"
          />
          <button
            type="submit"
            className="h-11 rounded-full bg-[color:var(--site-primary)] px-5 text-sm font-semibold text-[color:var(--site-buttonText)]"
          >
            <ContentText section={section} contentKey="ctaLabel" as="span">
              {content.ctaLabel ?? "Join the list"}
            </ContentText>
          </button>
        </form>
      </div>
    </SectionWrapper>
  );
};

const BlogIndexA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const posts = Array.isArray(content.posts)
    ? content.posts
    : [
        {
          title: "How we approach great service",
          excerpt: "A quick look at the systems and people behind our work.",
          date: "Jan 12"
        },
        {
          title: "3 ways to upgrade your customer experience",
          excerpt: "Practical improvements you can ship this week.",
          date: "Jan 05"
        }
      ];
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-6">
        <div>
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-3xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title ?? "Blog"}
          </ContentText>
          <ContentText section={section} contentKey="body" as="p" className="text-[color:var(--site-muted)]">
            {content.body ?? "Latest insights and updates."}
          </ContentText>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post: any, index: number) => (
            <a
              key={`${post.title}-${index}`}
              href={resolvePageHref("blog-post")}
              className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5 transition hover:border-[color:var(--site-primary)]"
            >
              <ContentText
                section={section}
                contentKey={`posts.${index}.date`}
                as="p"
                className="text-xs uppercase tracking-[0.2em] text-[color:var(--site-muted)]"
              >
                {post.date}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`posts.${index}.title`}
                as="h3"
                className="mt-3 text-xl font-semibold text-[color:var(--site-text)]"
              >
                {post.title}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`posts.${index}.excerpt`}
                as="p"
                className="mt-2 text-sm text-[color:var(--site-muted)]"
              >
                {post.excerpt}
              </ContentText>
            </a>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const BlogPostA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <article className="mx-auto max-w-3xl space-y-4">
        <ContentText
          section={section}
          contentKey="date"
          as="p"
          className="text-xs uppercase tracking-[0.2em] text-[color:var(--site-muted)]"
        >
          {content.date ?? "Featured"}
        </ContentText>
        <ContentText
          section={section}
          contentKey="title"
          as="h1"
          className="text-3xl font-semibold text-[color:var(--site-text)]"
        >
          {content.title ?? "Blog post title"}
        </ContentText>
        <ContentText section={section} contentKey="body" as="p" className="text-[color:var(--site-muted)]">
          {content.body ?? "Write your post content here."}
        </ContentText>
        <a
          href={resolvePageHref("blog")}
          className="inline-flex text-sm font-semibold text-[color:var(--site-primary)]"
        >
          Back to blog
        </a>
      </article>
    </SectionWrapper>
  );
};

const StoreListingA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const products = Array.isArray(content.products)
    ? content.products
    : [
        { name: "Starter Kit", price: "$49", description: "Essentials to get started." },
        { name: "Premium Bundle", price: "$129", description: "Best value for teams." }
      ];
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-6">
        <div>
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-3xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title ?? "Shop"}
          </ContentText>
          <ContentText section={section} contentKey="body" as="p" className="text-[color:var(--site-muted)]">
            {content.body ?? "Browse our featured products."}
          </ContentText>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((product: any, index: number) => (
            <a
              key={`${product.name}-${index}`}
              href={resolvePageHref("store-product")}
              className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5 transition hover:border-[color:var(--site-primary)]"
            >
              <ContentText
                section={section}
                contentKey={`products.${index}.name`}
                as="h3"
                className="text-xl font-semibold text-[color:var(--site-text)]"
              >
                {product.name}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`products.${index}.description`}
                as="p"
                className="mt-1 text-sm text-[color:var(--site-muted)]"
              >
                {product.description}
              </ContentText>
              <ContentText
                section={section}
                contentKey={`products.${index}.price`}
                as="p"
                className="mt-4 text-sm font-semibold text-[color:var(--site-primary)]"
              >
                {product.price}
              </ContentText>
            </a>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

const StoreProductA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-10 text-center text-sm text-[color:var(--site-muted)]">
          Product image
        </div>
        <div className="space-y-4">
          <ContentText
            section={section}
            contentKey="kicker"
            as="p"
            className="text-xs uppercase tracking-[0.2em] text-[color:var(--site-muted)]"
          >
            {content.kicker ?? "Product"}
          </ContentText>
          <ContentText
            section={section}
            contentKey="title"
            as="h1"
            className="text-3xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title ?? "Featured product"}
          </ContentText>
          <ContentText section={section} contentKey="body" as="p" className="text-[color:var(--site-muted)]">
            {content.body ?? "Describe the product details here."}
          </ContentText>
          <ContentText
            section={section}
            contentKey="price"
            as="p"
            className="text-lg font-semibold text-[color:var(--site-text)]"
          >
            {content.price ?? "$99"}
          </ContentText>
          <a
            href={resolvePageHref("store-cart")}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[color:var(--site-primary)] px-5 text-sm font-semibold text-[color:var(--site-buttonText)]"
          >
            Add to cart
          </a>
        </div>
      </div>
    </SectionWrapper>
  );
};

const StoreCartA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="mx-auto max-w-3xl space-y-4 rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-6">
        <ContentText
          section={section}
          contentKey="title"
          as="h2"
          className="text-2xl font-semibold text-[color:var(--site-text)]"
        >
          {content.title ?? "Your cart"}
        </ContentText>
        <ContentText section={section} contentKey="body" as="p" className="text-[color:var(--site-muted)]">
          {content.body ??
            "Checkout is coming soon. Continue building your catalog and connect payments in the dashboard."}
        </ContentText>
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-full border border-[color:var(--site-border)] px-5 text-sm font-semibold text-[color:var(--site-text)]"
        >
          Continue shopping
        </button>
      </div>
    </SectionWrapper>
  );
};

const AppEmbedA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const embedUrl = content.embedUrl as string | undefined;
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="space-y-4">
        <div>
          <ContentText
            section={section}
            contentKey="title"
            as="h2"
            className="text-2xl font-semibold text-[color:var(--site-text)]"
          >
            {content.title ?? "App widget"}
          </ContentText>
          <ContentText section={section} contentKey="body" as="p" className="text-[color:var(--site-muted)]">
            {content.body ?? "Configure this app in the Apps panel to finish setup."}
          </ContentText>
        </div>
        {embedUrl ? (
          <div className="overflow-hidden rounded-2xl border border-[color:var(--site-border)]">
            <iframe src={embedUrl} className="h-[420px] w-full" title="App widget" />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-8 text-center text-sm text-[color:var(--site-muted)]">
            Add your embed URL to show the widget here.
          </div>
        )}
      </div>
    </SectionWrapper>
  );
};

const CustomSectionA: SectionRenderer = ({ section, ctx }) => (
  <SectionWrapper section={section} ctx={ctx}>
    <div className="space-y-3">
      {section.content?.title ? (
        <ContentText section={section} contentKey="title" as="h2" className="text-2xl font-semibold text-[color:var(--site-text)]">
          {section.content.title}
        </ContentText>
      ) : null}
      {section.content?.body ? (
        <ContentText section={section} contentKey="body" as="p" className="text-[color:var(--site-muted)]">
          {section.content.body}
        </ContentText>
      ) : null}
    </div>
  </SectionWrapper>
);

const SECTION_VARIANTS: Record<string, Record<string, SectionRenderer>> = {
  hero: { A: HeroA, B: HeroB, C: HeroC, D: HeroC, E: HeroE, F: HeroF, G: HeroG, H: HeroH },
  services: { A: ServicesA, B: ServicesB, C: ServicesC, D: ServicesD, E: ServicesE, F: ServicesF, G: ServicesG },
  about: { A: AboutA, B: AboutB, C: AboutB, D: AboutD, E: AboutE, F: AboutF },
  gallery: { A: GalleryA, B: GalleryB, C: GalleryB, D: GalleryD, E: GalleryE },
  testimonials: { A: TestimonialsA, B: TestimonialsB, C: TestimonialsC, D: TestimonialsD, E: TestimonialsE, F: TestimonialsF },
  pricing: { A: PricingA, B: PricingB, C: PricingC, D: PricingD, E: PricingE },
  cta: { A: CtaA, B: CtaB, C: CtaB, D: CtaD, E: CtaE, F: CtaF },
  faq: { A: FaqA, B: FaqB, C: FaqC },
  contact: { A: ContactA, B: ContactB, C: ContactB, D: ContactD, E: ContactE, F: ContactF },
  reservation: { A: ReservationA, B: ReservationB, C: ReservationC },
  footer: { A: FooterA, B: FooterB, C: FooterC },
  newsletter: { A: NewsletterA },
  "blog-index": { A: BlogIndexA },
  "blog-post": { A: BlogPostA },
  "store-listing": { A: StoreListingA },
  "store-product": { A: StoreProductA },
  "store-cart": { A: StoreCartA },
  "app-embed": { A: AppEmbedA },
  custom: { A: CustomSectionA }
};

export const renderSection = (section: SiteSection, ctx: RenderContext) => {
  if (section.style.layoutMode === "freeform") {
    return FreeformSection({ section, ctx });
  }
  const typeGroup = SECTION_VARIANTS[section.type];
  const renderer = typeGroup?.[section.variant] ?? typeGroup?.A;
  if (!renderer) {
    return (
      <SectionWrapper section={section} ctx={ctx}>
        <div className="text-sm text-[color:var(--site-muted)]">
          Unsupported section: {section.type}
        </div>
      </SectionWrapper>
    );
  }
  return renderer({ section, ctx });
};
