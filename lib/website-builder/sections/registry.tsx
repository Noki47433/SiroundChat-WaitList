"use client";

import type { CSSProperties, ReactNode, MouseEvent, DragEvent } from "react";
import { Rnd } from "react-rnd";
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
  compact: "py-8",
  normal: "py-20",
  airy: "py-40"
};

const alignmentClasses: Record<SiteSection["style"]["alignment"], string> = {
  left: "text-left",
  center: "text-center"
};

const getButtonClass = (style: SiteSection["style"]) =>
  style.buttonStyle === "outline"
    ? "border border-[color:var(--site-primary)] text-[color:var(--site-primary)]"
    : "bg-[color:var(--site-primary)] text-[color:var(--site-buttonText)]";

const getSectionVars = (section: SiteSection): CSSProperties => {
  const overrides = section.style.colorOverride;
  if (!overrides) return {};
  return {
    ["--site-primary" as any]: overrides.primary ?? undefined,
    ["--site-bg" as any]: overrides.bg ?? undefined,
    ["--site-text" as any]: overrides.text ?? undefined
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
          fontFamily: "var(--site-fontHeading)"
        }
      : as === "h2"
        ? {
            fontSize: "var(--site-h2-size)",
            fontWeight: "var(--site-h2-weight)" as any,
            lineHeight: "var(--site-h2-line)",
            letterSpacing: "var(--site-h2-letter)",
            fontFamily: "var(--site-fontHeading)"
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
      data-section-id={section.id}
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
              className="h-full w-full rounded-2xl object-cover"
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

  const overlayOpacity = background.overlay ?? 0.45;
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
  ctx
}: {
  section: SiteSection;
  children: ReactNode;
  className?: string;
  ctx: RenderContext;
}) => {
  const { base, overlay } = getBackgroundLayers(section);
  const isPreview = resolvePreviewMode(ctx);
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
      } overflow-x-hidden bg-[color:var(--site-bg)] text-[color:var(--site-text)] ${previewClasses} ${className ?? ""}`}
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
      <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl px-6">
        {children}
        {renderElements(section, ctx)}
      </div>
    </section>
  );
};

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
  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
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
        <div className="overflow-hidden rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.src} alt={image.alt ?? "Hero"} className="h-full w-full object-cover" />
          ) : null}
        </div>
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
  const features = normalizeList(content.features, [
    "Trusted local team with practical support",
    "Clear communication and transparent process",
    "Book online or contact us directly"
  ]);

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
            <img src={image.src} alt={image.alt ?? "Hero"} className="h-full w-full object-cover" />
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
  const bullets = normalizeList(content.bullets, [
    "Locally trusted and customer focused",
    "Clear communication at every step",
    "Reliable delivery with consistent quality"
  ]);

  return (
    <SectionWrapper section={section} ctx={ctx}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
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
      </div>
    </SectionWrapper>
  );
};

const AboutB: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  const stats = normalizeList(content.stats, [
    { label: "Years of experience", value: "10+" },
    { label: "Projects delivered", value: "250+" },
    { label: "Client satisfaction", value: "98%" }
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
          <ContentText
            section={section}
            contentKey="body"
            as="p"
            className="text-sm text-[color:var(--site-muted)]"
          >
            {content.body}
          </ContentText>
        </div>
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
                <img src={image.src} alt={image.alt ?? "Gallery"} className="h-48 w-full object-cover" />
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
              className={`overflow-hidden rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] ${
                index === 0 ? "md:row-span-2" : ""
              }`}
            >
              {image.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.src}
                  alt={image.alt ?? "Gallery"}
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
  const items = normalizeList(content.items, [
    { quote: "This team delivered beyond expectations.", name: "Jordan Lee", role: "Founder" },
    { quote: "Clear communication and great results.", name: "Riley Patel", role: "Owner" },
    { quote: "We would absolutely work with them again.", name: "Taylor Kim", role: "Manager" }
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
  const items = normalizeList(content.items, [
    { quote: "Outstanding service and attention to detail.", name: "Avery Morgan", role: "Director" },
    { quote: "A partner we can rely on every time.", name: "Casey Rivera", role: "Lead" }
  ]);

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

const FooterA: SectionRenderer = ({ section, ctx }) => {
  const content = section.content as any;
  return (
    <footer className="border-t border-[color:var(--site-border)] bg-[color:var(--site-surface)]">
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
    <footer className="border-t border-[color:var(--site-border)] bg-[color:var(--site-surface)]">
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
  hero: { A: HeroA, B: HeroB, C: HeroC },
  services: { A: ServicesA, B: ServicesB, C: ServicesC },
  about: { A: AboutA, B: AboutB },
  gallery: { A: GalleryA, B: GalleryB },
  testimonials: { A: TestimonialsA, B: TestimonialsB },
  pricing: { A: PricingA, B: PricingB },
  cta: { A: CtaA, B: CtaB },
  faq: { A: FaqA, B: FaqB },
  contact: { A: ContactA, B: ContactB },
  reservation: { A: ReservationA, B: ReservationB },
  footer: { A: FooterA, B: FooterB },
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
