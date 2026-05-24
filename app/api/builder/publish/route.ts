import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import type { SiteDocument, SiteSection } from "@/lib/website-builder/types";
import { buildSitePath, slugify } from "@/lib/builder/utils";
import { BUILDER_SITES_BUCKET } from "@/lib/builder/storage";
import {
  buildPublishedSiteUrl,
  getRequestHost,
  getRequestProtocol
} from "@/lib/utils/published-site-url";
import { getBuilderPlanForRoute } from "@/lib/builder/plan";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { themeToCssVars } from "@/lib/website-builder/theme/vars";
import { logActivity } from "@/lib/activity/log";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import { parseIntegratedTemplateSiteDocument } from "@/lib/builder/template-sites/schema";
import { resolveLiveChat } from "@/lib/website-builder/live-chat";

export const runtime = "nodejs";

const PayloadSchema = z.object({
  siteId: z.string().uuid()
});

const getMissingBuilderColumnName = (error: unknown) => {
  if (!error || typeof error !== "object") return null;
  const code = "code" in error ? (error as { code?: unknown }).code : "";
  const message = "message" in error ? (error as { message?: unknown }).message : "";
  if (code !== "PGRST204" || typeof message !== "string") return null;
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
};

const updateBuilderSiteWithCompatibleColumns = async (
  adminClient: any,
  siteId: string,
  values: Record<string, unknown>
) => {
  const nextValues = { ...values };

  while (Object.keys(nextValues).length > 0) {
    const { error } = await adminClient.from("builder_sites").update(nextValues).eq("id", siteId);
    if (!error) {
      return null;
    }

    const missingColumn = getMissingBuilderColumnName(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(nextValues, missingColumn)) {
      delete nextValues[missingColumn];
      continue;
    }

    return error;
  }

  return new Error("No compatible builder_sites columns available for publish");
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

const buildRuntimePublishedUrl = (request: Request, slug: string) => {
  const protocol = getRequestProtocol(request.headers);
  const host = getRequestHost(request.headers);
  if (!host) return buildPublishedSiteUrl(slug);
  return `${protocol}://${host}/s/${slug}`;
};

const toKebab = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();

const styleToInlineCss = (style?: Record<string, any>) => {
  if (!style) return "";
  const entries = Object.entries(style).filter(([, val]) => val !== undefined && val !== null);
  if (!entries.length) return "";
  return entries
    .map(([key, val]) => `${toKebab(key)}:${String(val)}`)
    .join(";");
};

const buildBackgroundStyle = (section: SiteSection) => {
  const background = section.style?.background;
  const parts: string[] = [];
  if (!background || background.type === "plain") return "";

  if (background.type === "gradient") {
    const angle = typeof background.angle === "number" ? background.angle : 135;
    const stops = Array.isArray(background.stops) && background.stops.length
      ? background.stops
          .map((stop) => `${stop.color} ${stop.position}%`)
          .join(", ")
      : "rgba(0,0,0,0.04) 0%, rgba(0,0,0,0) 100%";
    parts.push(`background: linear-gradient(${angle}deg, ${stops});`);
  }

  if (background.type === "image" && background.value) {
    const overlay = Math.max(typeof background.overlay === "number" ? background.overlay : 0.35, 0.45);
    const overlayColor = `rgba(0,0,0,${overlay})`;
    const imageUrl = escapeHtml(background.value);
    parts.push(
      `background-image: linear-gradient(${overlayColor}, ${overlayColor}), url('${imageUrl}');`
    );
    parts.push(`background-size: ${background.size ?? "cover"};`);
    parts.push(`background-position: ${background.position ?? "center"};`);
    parts.push(`background-repeat: ${background.repeat ?? "no-repeat"};`);
  }

  const overrides = section.style?.colorOverride;
  if (overrides) {
    if (overrides.primary) parts.push(`--site-primary:${overrides.primary};`);
    if (overrides.bg) parts.push(`--site-bg:${overrides.bg};`);
    if (overrides.text) parts.push(`--site-text:${overrides.text};`);
  }

  return parts.join(" ");
};

const buildSectionShell = (section: SiteSection, innerHtml: string) => {
  const spacing = section.style?.spacing ?? "normal";
  const alignment = section.style?.alignment ?? "left";
  const classes = ["section", `section--${spacing}`, `section--${alignment}`];
  const styleAttr = buildBackgroundStyle(section);
  const styleTag = styleAttr ? ` style=\"${styleAttr}\"` : "";
  return `\n<section class=\"${classes.join(" ")}\" id=\"${section.id}\"${styleTag}>\n  <div class=\"section-inner\">${innerHtml}</div>\n</section>`;
};

const renderElements = (section: SiteSection) => {
  if (!section.elements?.length) return "";
  const layoutMode = section.style?.layoutMode ?? "flow";
  const isFreeform = layoutMode === "freeform";
  let maxBottom = 0;
  let maxRight = 0;
  const elementsHtml = section.elements
    .map((element, index) => {
      const frame = element.frame ?? (isFreeform ? { x: 24, y: 24 + index * 120, width: 320, height: 160 } : null);
      if (frame) {
        maxBottom = Math.max(maxBottom, frame.y + frame.height);
        maxRight = Math.max(maxRight, frame.x + frame.width);
      }
      const baseStyle = styleToInlineCss(element.style ?? undefined);
      const frameStyle = frame && isFreeform
        ? `position:absolute;left:${frame.x}px;top:${frame.y}px;width:${frame.width}px;height:${frame.height}px;`
        : "";
      const style = [baseStyle, frameStyle].filter(Boolean).join(";");
      const styleAttr = style ? ` style=\"${style}\"` : "";
      switch (element.type) {
        case "text":
          return `<div class=\"element-text\"${styleAttr}>${escapeHtml(element.text)}</div>`;
        case "image":
          return `<figure class=\"element-image\"${styleAttr}><img src=\"${escapeHtml(
            element.src
          )}\" alt=\"${escapeHtml(element.alt ?? "") }\" />${
            element.caption ? `<figcaption>${escapeHtml(element.caption)}</figcaption>` : ""
          }</figure>`;
        case "button":
          return `<a class=\"btn ${element.variant === "outline" ? "btn-outline" : "btn-solid"}\" data-cta=\"true\" href=\"${escapeHtml(
            element.href
          )}\"${styleAttr}>${escapeHtml(element.label)}</a>`;
        case "spacer":
          return `<div class=\"element-spacer\" style=\"height:${element.height ?? 24}px;\"></div>`;
        case "divider":
          return `<hr class=\"element-divider\" style=\"border-top:${element.thickness ?? 1}px solid ${escapeHtml(
            element.color ?? "var(--site-border)"
          )};\" />`;
        default:
          return "";
      }
    })
    .join("");

  const containerStyle = isFreeform
    ? ` style=\"position:relative;min-height:${Math.max(maxBottom + 24, 240)}px;min-width:${
        Math.max(maxRight + 24, 320)
      }px;\"`
    : "";
  const containerClass = isFreeform ? "elements-freeform" : "elements-flow";
  return `<div class=\"${containerClass}\"${containerStyle}>${elementsHtml}</div>`;
};

const renderHero = (section: SiteSection) => {
  const content = section.content ?? {};
  const image = section.images?.[0];
  const imageHtml = image
    ? `<div class=\"hero-media\"><img src=\"${escapeHtml(image.src)}\" width=\"${image.width ?? 1600}\" height=\"${
        image.height ?? 1000
      }\" alt=\"${escapeHtml(
        image.alt ?? ""
      )}\" /></div>`
    : "";
  const cta = content.ctaLabel
    ? `<a class=\"btn btn-solid\" data-cta=\"true\" href=\"${escapeHtml(content.ctaHref ?? "#contact")}\">${escapeHtml(
        content.ctaLabel
      )}</a>`
    : "";
  return `
    <div class=\"hero-grid\">
      <div>
        <p class=\"eyebrow\">${escapeHtml(content.eyebrow ?? section.name ?? "Welcome")}</p>
        <h1>${escapeHtml(content.headline ?? "Welcome")}</h1>
        <p class=\"lead\">${escapeHtml(content.subheadline ?? "")}</p>
        ${cta}
      </div>
      ${imageHtml}
    </div>
  `;
};

const renderAbout = (section: SiteSection) => {
  const content = section.content ?? {};
  return `
    <div class=\"split-grid\">
      <div>
        <h2>${escapeHtml(content.title ?? "About")}</h2>
        <p>${escapeHtml(content.body ?? "")}</p>
      </div>
      <div class=\"card\">
        ${(content.bullets ?? content.items ?? [])
          .map((item: any) => `<div class=\"bullet\">• ${escapeHtml(item.text ?? item)}</div>`)
          .join("")}
      </div>
    </div>
  `;
};

const renderServices = (section: SiteSection) => {
  const content = section.content ?? {};
  const items = Array.isArray(content.items) ? content.items : [];
  return `
    <h2>${escapeHtml(content.title ?? "Services")}</h2>
    <div class=\"card-grid\">
      ${items
        .map(
          (item: any) =>
            `<div class=\"card\"><h3>${escapeHtml(item.title ?? item.name ?? "")}</h3><p>${escapeHtml(
              item.body ?? item.description ?? ""
            )}</p></div>`
        )
        .join("")}
    </div>
  `;
};

const renderGallery = (section: SiteSection) => {
  const content = section.content ?? {};
  const images = Array.isArray(section.images) ? section.images : [];
  return `
    <h2>${escapeHtml(content.title ?? "Gallery")}</h2>
    <div class=\"gallery-grid\">
      ${images
        .map(
          (image) =>
            `<div class=\"gallery-item\"><img src=\"${escapeHtml(image.src)}\" width=\"${image.width ?? 1200}\" height=\"${
              image.height ?? 900
            }\" alt=\"${escapeHtml(
              image.alt ?? ""
            )}\" /></div>`
        )
        .join("")}
    </div>
  `;
};

const renderTestimonials = (section: SiteSection) => {
  const content = section.content ?? {};
  const items = Array.isArray(content.items) ? content.items : [];
  return `
    <h2>${escapeHtml(content.title ?? "Testimonials")}</h2>
    <div class=\"card-grid\">
      ${items
        .map(
          (item: any) =>
            `<div class=\"card\"><p class=\"quote\">“${escapeHtml(item.quote ?? item.body ?? "") }”</p><p class=\"meta\">${escapeHtml(
              item.name ?? item.author ?? ""
            )}</p></div>`
        )
        .join("")}
    </div>
  `;
};

const renderPricing = (section: SiteSection) => {
  const content = section.content ?? {};
  const plans = Array.isArray(content.plans) ? content.plans : [];
  return `
    <h2>${escapeHtml(content.title ?? "Pricing")}</h2>
    <div class=\"card-grid\">
      ${plans
        .map(
          (plan: any) =>
            `<div class=\"card\"><h3>${escapeHtml(plan.name ?? "")}</h3><p class=\"price\">${escapeHtml(
              plan.price ?? ""
            )}</p><p>${escapeHtml(plan.description ?? "")}</p>${
              Array.isArray(plan.features)
                ? `<ul>${plan.features.map((f: string) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
                : ""
            }</div>`
        )
        .join("")}
    </div>
  `;
};

const renderFaq = (section: SiteSection) => {
  const content = section.content ?? {};
  const items = Array.isArray(content.items) ? content.items : [];
  return `
    <h2>${escapeHtml(content.title ?? "FAQ")}</h2>
    <div class=\"faq-list\">
      ${items
        .map(
          (item: any) =>
            `<details><summary>${escapeHtml(item.question ?? item.title ?? "")}</summary><p>${escapeHtml(
              item.answer ?? item.body ?? ""
            )}</p></details>`
        )
        .join("")}
    </div>
  `;
};

const renderCta = (section: SiteSection) => {
  const content = section.content ?? {};
  return `
    <div class=\"cta-block\">
      <h2>${escapeHtml(content.title ?? "")}</h2>
      <p>${escapeHtml(content.body ?? "")}</p>
      ${
        content.ctaLabel
          ? `<a class=\"btn btn-solid\" data-cta=\"true\" href=\"${escapeHtml(content.ctaHref ?? "#contact")}\">${escapeHtml(
              content.ctaLabel
            )}</a>`
          : ""
      }
    </div>
  `;
};

const renderContact = (section: SiteSection, slug: string, siteId: string) => {
  const content = section.content ?? {};
  return `
    <h2>${escapeHtml(content.title ?? "Contact")}</h2>
    <p>${escapeHtml(content.body ?? "")}</p>
    <form class=\"contact-form\" method=\"post\" action=\"/api/site/forms/submit\">
      <input type=\"hidden\" name=\"slug\" value=\"${escapeHtml(slug)}\" />
      <input type=\"hidden\" name=\"siteId\" value=\"${escapeHtml(siteId)}\" />
      <input type=\"hidden\" name=\"form_type\" value=\"contact\" />
      <div class=\"field\"><label>Name</label><input name=\"name\" required /></div>
      <div class=\"field\"><label>Email</label><input name=\"email\" type=\"email\" required /></div>
      <div class=\"field\"><label>Message</label><textarea name=\"message\" rows=\"5\" required></textarea></div>
      <button type=\"submit\" class=\"btn btn-solid\">Send message</button>
    </form>
  `;
};

const renderReservation = (section: SiteSection, slug: string, siteId: string) => {
  const content = section.content ?? {};
  return `
    <h2>${escapeHtml(content.title ?? "Reservations")}</h2>
    <p>${escapeHtml(content.body ?? "")}</p>
    <form class=\"reservation-form\" method=\"post\" action=\"/api/site/forms/submit\">
      <input type=\"hidden\" name=\"slug\" value=\"${escapeHtml(slug)}\" />
      <input type=\"hidden\" name=\"siteId\" value=\"${escapeHtml(siteId)}\" />
      <input type=\"hidden\" name=\"form_type\" value=\"reservation\" />
      <div class=\"field\"><label>Name</label><input name=\"name\" required /></div>
      <div class=\"field\"><label>Date</label><input name=\"date\" type=\"date\" required /></div>
      <div class=\"field\"><label>Time</label><input name=\"time\" type=\"time\" required /></div>
      <div class=\"field\"><label>Phone or Email</label><input name=\"contact\" required /></div>
      <div class=\"field\"><label>Party size</label><input name=\"party_size\" placeholder=\"Optional\" /></div>
      <button type=\"submit\" class=\"btn btn-solid\">Request reservation</button>
    </form>
  `;
};

const renderFooter = (section: SiteSection) => {
  const content = section.content ?? {};
  return `
    <div class=\"footer\">${escapeHtml(content.text ?? "")}</div>
  `;
};

const renderNewsletter = (section: SiteSection) => {
  const content = section.content ?? {};
  return `
    <h2>${escapeHtml(content.title ?? "Stay in touch")}</h2>
    <p>${escapeHtml(content.body ?? "")}</p>
    <form class=\"newsletter-form\">
      <input type=\"email\" placeholder=\"Email\" required />
      <button type=\"submit\" class=\"btn btn-solid\">${escapeHtml(content.ctaLabel ?? "Subscribe")}</button>
    </form>
  `;
};

const renderSectionHtml = (section: SiteSection, slug: string, siteId: string) => {
  if (!section.enabled) return "";
  let inner = "";
  switch (section.type) {
    case "hero":
      inner = renderHero(section);
      break;
    case "about":
      inner = renderAbout(section);
      break;
    case "services":
      inner = renderServices(section);
      break;
    case "gallery":
      inner = renderGallery(section);
      break;
    case "testimonials":
      inner = renderTestimonials(section);
      break;
    case "pricing":
      inner = renderPricing(section);
      break;
    case "faq":
      inner = renderFaq(section);
      break;
    case "cta":
      inner = renderCta(section);
      break;
    case "contact":
      inner = renderContact(section, slug, siteId);
      break;
    case "reservation":
      inner = renderReservation(section, slug, siteId);
      break;
    case "footer":
      inner = renderFooter(section);
      break;
    case "newsletter":
      inner = renderNewsletter(section);
      break;
    default:
      inner = "";
  }

  const elements = renderElements(section);
  const combined = `${inner}${elements}`;
  if (!combined.trim()) return "";
  return buildSectionShell(section, combined);
};

const buildCss = (site: SiteDocument) => {
  const cssVars = themeToCssVars(site.theme);
  const vars = Object.entries(cssVars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");

  return `:root{${vars}}
*{box-sizing:border-box;}
body{margin:0;font-family:var(--site-fontBody);color:var(--site-text);background:var(--site-bg);line-height:1.6;}
img{max-width:100%;height:auto;border-radius:var(--site-radius);}
a{text-decoration:none;color:inherit;}
.section{position:relative;}
.section--compact{padding:32px 0;}
.section--normal{padding:48px 0;}
.section--airy{padding:64px 0;}
.section--center{text-align:center;}
.section-inner{width:min(1100px,92%);margin:0 auto;}
.eyebrow{text-transform:uppercase;letter-spacing:0.2em;font-size:0.75rem;color:var(--site-muted);}
.lead{font-size:1.1rem;color:var(--site-muted);}
.hero-grid{display:grid;gap:48px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:center;}
.hero-media img{box-shadow:0 24px 60px rgba(0,0,0,0.15);}
.split-grid{display:grid;gap:32px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));align-items:start;}
.card-grid{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));}
.card{padding:24px;border-radius:var(--site-radius);background:var(--site-surface);border:1px solid var(--site-border);box-shadow:0 18px 40px rgba(0,0,0,0.08);}
.gallery-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));}
.gallery-item img{width:100%;height:100%;object-fit:cover;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;border-radius:999px;font-weight:600;border:1px solid transparent;}
.btn-solid{background:var(--site-primary);color:var(--site-buttonText);}
.btn-outline{border-color:var(--site-primary);color:var(--site-primary);background:transparent;}
.cta-block{padding:32px;border-radius:var(--site-radius);background:var(--site-secondary);border:1px solid var(--site-border);display:flex;flex-direction:column;gap:16px;align-items:flex-start;}
.faq-list details{padding:16px;border-radius:var(--site-radius);background:var(--site-surface);border:1px solid var(--site-border);margin-bottom:12px;}
.contact-form,.reservation-form,.newsletter-form{display:grid;gap:16px;margin-top:16px;}
.field{display:flex;flex-direction:column;gap:8px;}
input,textarea{padding:12px 14px;border-radius:12px;border:1px solid var(--site-border);background:white;font:inherit;}
.footer{padding:32px 0;text-align:center;color:var(--site-muted);}
.elements-flow{display:flex;flex-direction:column;gap:16px;margin-top:24px;}
.elements-freeform{margin-top:24px;}
.element-divider{border:none;}
`;};

const buildNav = (site: SiteDocument) => {
  const pages = site.pages.filter((page) => page.showInMenu !== false && !page.isSystem);
  if (!pages.length) return "";
  const sorted = [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const links = sorted
    .map(
      (page) =>
        `<a class=\"nav-link\" href=\"?page=${escapeHtml(page.slug)}\" data-page-link=\"${escapeHtml(
          page.slug
        )}\">${escapeHtml(page.menuTitle ?? page.name)}</a>`
    )
    .join("");
  return `\n<nav class=\"site-nav\"><div class=\"section-inner nav-inner\">${links}</div></nav>`;
};

const buildAnalyticsScript = (params: { businessId: string; siteId: string }) => {
  const config = safeJson({ businessId: params.businessId, siteId: params.siteId });
  return `
<script>
(function(){
  var cfg = ${config};
  if (!cfg || !cfg.businessId) return;
  var SESSION_KEY = "sc_session_id";
  function safeId(){
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "sc-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }
  function getSessionId(){
    try {
      var existing = localStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      var next = safeId();
      localStorage.setItem(SESSION_KEY, next);
      return next;
    } catch (e) {
      return "";
    }
  }
  function normalizePath(slug){
    if (!slug || slug === "home" || slug === "index") return "/";
    if (slug.charAt(0) === "/") return slug;
    return "/" + slug;
  }
  function activePageSlug(){
    var params = new URLSearchParams(window.location.search);
    var target = params.get("page");
    if (target) return target;
    var first = document.querySelector("[data-page]");
    return first ? (first.getAttribute("data-page") || "") : "";
  }
  function activePageTitle(slug){
    var selector = slug ? '[data-page=\"' + slug + '\"]' : "[data-page]";
    var el = document.querySelector(selector);
    if (el) {
      var title = el.getAttribute("data-page-title");
      if (title) return title;
    }
    return document.title || "";
  }
  function send(payload){
    var sessionId = getSessionId();
    if (!sessionId) return;
    payload.sessionId = sessionId;
    payload.referrer = document.referrer || null;
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics/ingest", body);
        return;
      }
      fetch("/api/analytics/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body
      }).catch(function(){});
    } catch (e) {}
  }
  function trackPageView(){
    var slug = activePageSlug();
    var pagePath = normalizePath(slug);
    var pageTitle = activePageTitle(slug);
    send({
      businessId: cfg.businessId,
      siteId: cfg.siteId,
      pagePath: pagePath,
      pageTitle: pageTitle,
      eventType: "page_view",
      channel: "website"
    });
  }
  function classifyCta(href){
    if (!href) return "other";
    var lower = href.toLowerCase();
    if (lower.indexOf("tel:") === 0) return "call";
    if (lower.indexOf("mailto:") === 0) return "email";
    if (lower.indexOf("wa.me") !== -1 || lower.indexOf("whatsapp") !== -1) return "whatsapp";
    if (lower.indexOf("maps") !== -1 || lower.indexOf("google.com/maps") !== -1) return "directions";
    if (lower.indexOf("booking") !== -1 || lower.indexOf("reserve") !== -1) return "booking";
    return "other";
  }
  document.addEventListener("click", function(event){
    var target = event.target;
    if (!target || !target.closest) return;
    var anchor = target.closest("a");
    if (!anchor) return;
    if (!anchor.classList.contains("btn") && !anchor.hasAttribute("data-cta")) return;
    var href = anchor.getAttribute("href") || "";
    var slug = activePageSlug();
    var pagePath = normalizePath(slug);
    var pageTitle = activePageTitle(slug);
    send({
      businessId: cfg.businessId,
      siteId: cfg.siteId,
      pagePath: pagePath,
      pageTitle: pageTitle,
      eventType: "cta_click",
      channel: "website",
      ctaType: classifyCta(href)
    });
  });
  document.addEventListener("submit", function(event){
    var form = event.target;
    if (!form || !form.classList) return;
    if (!form.classList.contains("contact-form") && !form.classList.contains("reservation-form")) return;
    var slug = activePageSlug();
    var pagePath = normalizePath(slug);
    var pageTitle = activePageTitle(slug);
    send({
      businessId: cfg.businessId,
      siteId: cfg.siteId,
      pagePath: pagePath,
      pageTitle: pageTitle,
      eventType: "lead_submitted",
      channel: "form",
      leadType: "form"
    });
  });
  trackPageView();
})();
</script>`;
};

const buildStructuredData = (site: SiteDocument, canonicalUrl: string) => {
  const industry = site.siteBrief?.industry?.toLowerCase() ?? "";
  const type = industry.includes("barber")
    ? "Barbershop"
    : industry.includes("restaurant")
      ? "Restaurant"
      : industry.includes("dental") || industry.includes("dentist")
        ? "Dentist"
        : industry.includes("real estate") || industry.includes("real-estate") || industry.includes("realty")
          ? "RealEstateAgent"
          : "LocalBusiness";

  return safeJson({
    "@context": "https://schema.org",
    "@type": type,
    name: site.siteBrief?.businessName ?? "Business",
    image: site.siteBrief?.logoUrl ?? site.seo?.ogImage ?? undefined,
    description: site.seo?.description ?? undefined,
    url: canonicalUrl
  });
};

const buildHtml = (
  site: SiteDocument,
  slug: string,
  liveChatScriptSrc: string | null,
  liveChatInlineScript: string | null,
  businessId: string,
  siteId: string,
  canonicalUrl: string
) => {
  const hero = site.pages?.[0]?.sections?.find((section) => section.type === "hero");
  const heroHeadline = (hero?.content as { headline?: string } | undefined)?.headline ?? site.siteBrief?.businessName ?? "";
  const seoTitle = site.seo?.title ?? (heroHeadline ? `${heroHeadline}` : "SiroundChat Site");
  const seoDescription = site.seo?.description ?? "Learn more about this business.";
  const ogImage = site.seo?.ogImage ?? "";

  const nav = buildNav(site);
  const pagesHtml = site.pages
    .map((page, index) => {
      const pageTitle = page.menuTitle ?? page.name ?? page.slug;
      const sectionsHtml = page.sections.map((section) => renderSectionHtml(section, slug, siteId)).join("");
      return `<main class=\"site-page\" data-page=\"${escapeHtml(page.slug)}\" style=\"display:${
        index === 0 ? "block" : "none"
      };\" data-page-title=\"${escapeHtml(pageTitle)}\">${sectionsHtml}</main>`;
    })
    .join("");

  const customHead = site.customCode?.head ?? "";
  const customBody = site.customCode?.body ?? "";
  const analyticsScript = buildAnalyticsScript({ businessId, siteId });
  const widgetScript = liveChatScriptSrc
    ? `<script src=\"${escapeHtml(liveChatScriptSrc)}\" async></script>`
    : "";
  const inlineChatScript = liveChatInlineScript ? `<script>${liveChatInlineScript}</script>` : "";
  const structuredData = buildStructuredData(site, canonicalUrl);

  const pagerScript = `
<script>
(function(){
  var params = new URLSearchParams(window.location.search);
  var target = params.get('page');
  var pages = document.querySelectorAll('[data-page]');
  if (!pages.length) return;
  pages.forEach(function(page, index){
    var slug = page.getAttribute('data-page');
    page.style.display = (!target && index === 0) || (target && slug === target) ? 'block' : 'none';
  });
})();
</script>`;

  return `<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>${escapeHtml(seoTitle)}</title>
  <meta name=\"description\" content=\"${escapeHtml(seoDescription)}\" />
  <link rel=\"canonical\" href=\"${escapeHtml(canonicalUrl)}\" />
  <meta name=\"robots\" content=\"index,follow\" />
  ${ogImage ? `<meta property=\"og:image\" content=\"${escapeHtml(ogImage)}\" />` : ""}
  <meta property=\"og:title\" content=\"${escapeHtml(seoTitle)}\" />
  <meta property=\"og:description\" content=\"${escapeHtml(seoDescription)}\" />
  <meta property=\"og:url\" content=\"${escapeHtml(canonicalUrl)}\" />
  <script type=\"application/ld+json\">${structuredData}</script>
  <link rel=\"stylesheet\" href=\"/published/${escapeHtml(slug)}/styles.css\" />
  ${customHead}
</head>
<body>
  ${nav}
  ${pagesHtml}
  ${customBody}
  ${analyticsScript}
  ${widgetScript}
  ${inlineChatScript}
  ${pagerScript}
</body>
</html>`;
};

const ensureSlug = async (
  supabase: ReturnType<typeof getSupabaseRouteClient>,
  siteId: string,
  businessName: string
) => {
  const base = slugify(businessName);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const slug = `${base}${suffix}`;
    const { data, error } = await (supabase as any)
      .from("builder_sites")
      .update({ slug, path: buildSitePath(slug) })
      .eq("id", siteId)
      .select("slug")
      .single();

    if (error) {
      if (error.code === "23505") {
        continue;
      }
      throw error;
    }

    if (data?.slug) {
      return data.slug as string;
    }
  }

  throw new Error("Failed to reserve slug");
};

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { siteId } = parsed.data;

  const site = await getOwnedBuilderSite<{
    id: string;
    business_id: string;
    slug: string | null;
    path: string | null;
    status: string | null;
    site_document: unknown;
    business_name: string | null;
    industry: string | null;
    logo_url: string | null;
  }>(
    siteId,
    userData.user.id,
    "id,business_id,slug,path,status,site_document,business_name,industry,logo_url"
  );

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { flags } = await getBuilderPlanForRoute(site.business_id as string);
  if (!flags.canPublish) {
    const billingAccess = await getBusinessEntitlementAccess(site.business_id as string, "publish_website");
    return buildUpgradeRequiredResponse("publish_website", billingAccess);
  }

  if (!site.site_document) {
    return NextResponse.json({ error: "Site document missing" }, { status: 400 });
  }

  const integratedDocument = parseIntegratedTemplateSiteDocument(site.site_document);
  if (integratedDocument) {
    let slug = site.slug as string | null;
    if (!slug) {
      try {
        slug = await ensureSlug(supabase, siteId, site.business_name ?? "site");
      } catch (error) {
        console.error("[BUILDER_SLUG_ERROR]", error);
        return NextResponse.json({ error: "Failed to reserve slug" }, { status: 500 });
      }
    }

    const resolvedPath = site.path || buildSitePath(slug);
    const publishedUrl = buildRuntimePublishedUrl(request, slug);
    const integratedUpdate = {
      status: "published",
      slug,
      path: resolvedPath,
      published_url: publishedUrl,
      site_document: integratedDocument,
      seo_title: integratedDocument.meta.seo.title ?? null,
      seo_description: integratedDocument.meta.seo.description ?? null
    };

    try {
      const adminClient = getSupabaseAdminClientIfAvailable();
      if (!adminClient) {
        console.error("[BUILDER_PUBLISH_CONFIG_MISSING]", { siteId, userId: userData.user.id });
        return NextResponse.json({ error: "Publishing is unavailable right now." }, { status: 500 });
      }

      const updateError = await updateBuilderSiteWithCompatibleColumns(
        adminClient as any,
        siteId,
        integratedUpdate
      );

      if (updateError) {
        throw updateError;
      }

      await logActivity({
        businessId: site.business_id as string,
        userId: userData.user.id,
        actorType: "business_user",
        eventType: "website_publish",
        summary: `Published site "${site.business_name}"`,
        meta: { site_id: siteId, url: publishedUrl }
      });

      return NextResponse.json({ url: publishedUrl });
    } catch (error) {
      console.error("[BUILDER_PUBLISH_ERROR]", error);
      return NextResponse.json({ error: "Failed to publish site" }, { status: 500 });
    }
  }

  const parsedDoc = SiteDocumentSchema.safeParse(site.site_document);
  if (!parsedDoc.success) {
    return NextResponse.json(
      { error: "Invalid site document", issues: parsedDoc.error.issues },
      { status: 400 }
    );
  }

  const document = parsedDoc.data;

  let slug = site.slug as string | null;
  if (!slug) {
    try {
      slug = await ensureSlug(supabase, siteId, site.business_name ?? "site");
    } catch (error) {
      console.error("[BUILDER_SLUG_ERROR]", error);
      return NextResponse.json({ error: "Failed to reserve slug" }, { status: 500 });
    }
  }

  const resolvedPath = site.path || buildSitePath(slug);

  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("widget_key")
    .eq("id", site.business_id)
    .maybeSingle();

  const liveChat = resolveLiveChat(
    {
      ...document,
      siteBrief: {
        ...document.siteBrief,
        businessName: document.siteBrief?.businessName ?? site.business_name ?? undefined,
        logoUrl: document.siteBrief?.logoUrl ?? site.logo_url ?? undefined,
        industry: document.siteBrief?.industry ?? site.industry ?? undefined
      }
    },
    { widgetKey: business?.widget_key ?? siteId }
  );

  if (liveChat.error) {
    return NextResponse.json({ error: liveChat.error }, { status: 400 });
  }

  const resolvedLiveChat = flags.canAttachChatbotToWebsite
    ? liveChat
    : { ...liveChat, enabled: false, scriptSrc: null, inlineScript: null };

  const cssContent = buildCss(resolvedLiveChat.document);
  const publishedUrl = buildRuntimePublishedUrl(request, slug);
  const htmlContent = buildHtml(
    resolvedLiveChat.document,
    slug,
    resolvedLiveChat.scriptSrc,
    resolvedLiveChat.inlineScript,
    site.business_id as string,
    site.id as string,
    publishedUrl
  );

  try {
    const adminClient = getSupabaseAdminClientIfAvailable();
    if (!adminClient) {
      console.error("[BUILDER_PUBLISH_CONFIG_MISSING]", { siteId, userId: userData.user.id });
      return NextResponse.json({ error: "Publishing is unavailable right now." }, { status: 500 });
    }
    const storage = adminClient.storage.from(BUILDER_SITES_BUCKET);
    const indexPath = `published/${slug}/index.html`;
    const cssPath = `published/${slug}/styles.css`;
    const historyStamp = new Date().toISOString().replace(/[:.]/g, "-");
    const historyPath = `published/${slug}/history/${historyStamp}.html`;

    const indexUpload = await storage.upload(indexPath, Buffer.from(htmlContent), {
      contentType: "text/html; charset=utf-8",
      upsert: true
    });

    if (indexUpload.error) {
      throw indexUpload.error;
    }

    const cssUpload = await storage.upload(cssPath, Buffer.from(cssContent), {
      contentType: "text/css; charset=utf-8",
      upsert: true
    });

    if (cssUpload.error) {
      throw cssUpload.error;
    }

    await storage.upload(historyPath, Buffer.from(htmlContent), {
      contentType: "text/html; charset=utf-8",
      upsert: true
    });

    const baseUpdate = {
      status: "published",
      slug,
      path: resolvedPath,
      published_url: publishedUrl,
      site_document: liveChat.document
    };

    const seoUpdate = {
      ...baseUpdate,
      seo_title: liveChat.document.seo?.title ?? null,
      seo_description: liveChat.document.seo?.description ?? null
    };

    const updateError = await updateBuilderSiteWithCompatibleColumns(adminClient as any, siteId, seoUpdate);

    if (updateError) {
      throw updateError;
    }

    await logActivity({
      businessId: site.business_id as string,
      userId: userData.user.id,
      actorType: "business_user",
      eventType: "website_publish",
      summary: `Published site "${site.business_name}"`,
      meta: { site_id: siteId, url: publishedUrl }
    });

    return NextResponse.json({ url: publishedUrl });
  } catch (error) {
    console.error("[BUILDER_PUBLISH_ERROR]", error);
    const adminClient = getSupabaseAdminClientIfAvailable();
    if (adminClient) {
      await (adminClient as any)
        .from("builder_sites")
        .update({ status: "error" })
        .eq("id", siteId);
    }

    return NextResponse.json({ error: "Failed to publish site" }, { status: 500 });
  }
}
