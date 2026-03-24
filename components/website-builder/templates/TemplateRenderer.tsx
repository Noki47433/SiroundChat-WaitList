"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SiteDocument } from "@/lib/website-builder/types";
import { renderButtonClass, resolveSiteRenderDNA } from "@/lib/website-builder/rendering/dna";
import { renderSection } from "@/lib/website-builder/sections/registry";
import { themeToCssVars } from "@/lib/website-builder/theme/vars";
import { trackPageView } from "@/lib/analytics/track";
import { ChatPromptTopBar } from "@/components/website-builder/templates/ChatPromptTopBar";

const CHAT_OPENED_SESSION_KEY = "siround_chat_opened_this_session";

type TemplateProps = {
  site: SiteDocument;
  analytics?: {
    businessId?: string;
    siteId?: string | null;
    pageTitle?: string | null;
    enabled?: boolean;
  };
  preview?: boolean;
};

export function TemplateRenderer({ site, analytics, preview = false }: TemplateProps) {
  const [pagePath, setPagePath] = useState<string>("/");
  const [activePageSlug, setActivePageSlug] = useState<string>(site.pages?.[0]?.slug ?? "home");
  const [glowActive, setGlowActive] = useState(false);

  const themeVars = useMemo(() => themeToCssVars(site.theme), [site.theme]);
  const renderDNA = useMemo(() => resolveSiteRenderDNA(site), [site]);

  const resolvePageFromSearch = useCallback(() => {
    if (typeof window === "undefined") return site.pages?.[0]?.slug ?? "home";
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("page");
    if (slug && site.pages?.some((page) => page.slug === slug)) {
      return slug;
    }
    return site.pages?.[0]?.slug ?? "home";
  }, [site.pages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPagePath(`${window.location.pathname || "/"}${window.location.search || ""}`);
    setActivePageSlug(resolvePageFromSearch());
  }, [resolvePageFromSearch]);

  useEffect(() => {
    const handler = () => {
      const next = resolvePageFromSearch();
      setActivePageSlug(next);
      if (typeof window !== "undefined") {
        setPagePath(`${window.location.pathname || "/"}${window.location.search || ""}`);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [resolvePageFromSearch]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!body) return;
    const entries = Object.entries(themeVars);
    entries.forEach(([key, value]) => {
      body.style.setProperty(key, String(value));
    });
    return () => {
      entries.forEach(([key]) => body.style.removeProperty(key));
    };
  }, [themeVars]);

  const activePage = useMemo(() => {
    return site.pages.find((page) => page.slug === activePageSlug) ?? site.pages[0];
  }, [activePageSlug, site.pages]);

  const sections = activePage?.sections ?? [];
  const contactSection = sections.find((section) => section.type === "contact");
  const contactPhoneRaw =
    contactSection && contactSection.content && typeof (contactSection.content as any).phone === "string"
      ? ((contactSection.content as any).phone as string).trim()
      : "";
  const contactPhoneHref = contactPhoneRaw ? `tel:${contactPhoneRaw.replace(/[^\d+]/g, "")}` : null;
  const primaryHeaderCtaLabel =
    site.templateId.includes("clinic") || site.templateId.includes("dental")
      ? "Book a Visit"
      : site.templateId.includes("real-estate")
        ? "Inquire"
        : "Get Started";
  const brandLogoUrl = site.siteBrief?.logoUrl?.trim() || null;
  const activeNavClass = renderDNA.industryKey === "barbershop" ? "text-white opacity-100" : "text-[color:var(--site-text)] opacity-100";
  const inactiveNavClass = renderDNA.industryKey === "barbershop" ? "text-white/72 opacity-100" : "opacity-75";
  const phoneClassName =
    renderDNA.industryKey === "barbershop" ? "text-sm font-medium text-white/72" : "text-sm font-medium text-[color:var(--site-muted)]";

  const menuPages = useMemo(() => {
    const pages = site.pages.filter((page) => page.showInMenu !== false && !page.isSystem);
    const sorted = [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const seen = new Set<string>();
    return sorted.filter((page) => {
      const key = page.slug || page.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [site.pages]);

  const menuTree = useMemo(() => {
    const tree = new Map<string | null, typeof menuPages>();
    menuPages.forEach((page) => {
      const key = page.parentId ?? null;
      const list = tree.get(key) ?? [];
      list.push(page);
      tree.set(key, list);
    });
    tree.forEach((pages) => pages.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return tree;
  }, [menuPages]);

  const handleNavigate = (slug: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("page", slug);
    window.history.pushState({}, "", url.toString());
    setActivePageSlug(slug);
    setPagePath(`${url.pathname}${url.search}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const transitionClass =
    site.theme.pageTransitions === "fade"
      ? "animate-[site-fade_0.3s_ease]"
      : site.theme.pageTransitions === "slide"
        ? "animate-[site-slide_0.35s_ease]"
        : "";

  const analyticsContext = useMemo(() => {
    if (!analytics) return null;
    const hero = activePage?.sections?.find((section) => section.type === "hero");
    const heroTitle = (hero?.content as { headline?: string } | undefined)?.headline ?? null;
    const title = heroTitle ?? analytics.pageTitle ?? (typeof document !== "undefined" ? document.title : null);
    return {
      businessId: analytics.businessId,
      siteId: analytics.siteId ?? null,
      pagePath,
      pageTitle: title ?? null,
      enabled: analytics.enabled !== false
    };
  }, [activePage, analytics, pagePath]);

  const chatPromptEnabled = site.chat_prompt_topbar_enabled === true;
  const chatGlowEnabled = site.chat_launcher_glow_enabled === true;

  const markChatOpened = useCallback(() => {
    setGlowActive(false);
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(CHAT_OPENED_SESSION_KEY, "1");
    } catch {
      // ignore storage errors
    }
  }, []);

  const glowClasses = useMemo(
    () => [
      "ring-2",
      "ring-[color:var(--site-accent)]/40",
      "shadow-[0_0_24px_rgba(255,255,255,0.25)]",
      "animate-pulse",
      "rounded-full"
    ],
    []
  );

  const updateGlowClasses = useCallback(
    (active: boolean) => {
      if (typeof document === "undefined") return;
      const container = document.getElementById("promptly-widget");
      if (!container) return;
      if (active) {
        container.classList.add(...glowClasses);
      } else {
        container.classList.remove(...glowClasses);
      }
    },
    [glowClasses]
  );

  const resolveWidgetLauncher = useCallback(() => {
    if (typeof document === "undefined") return null;
    const container = document.getElementById("promptly-widget") as HTMLDivElement | null;
    if (!container) return null;
    const shadow = container.shadowRoot;
    const iframe = shadow?.querySelector("iframe") as HTMLIFrameElement | null;
    if (!iframe) return null;
    try {
      const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document ?? null;
      if (!iframeDoc) return null;
      return iframeDoc.querySelector('[data-widget-launcher=\"true\"]') as HTMLButtonElement | null;
    } catch {
      return null;
    }
  }, []);

  const openChat = useCallback(() => {
    if (typeof window === "undefined") return;
    const tryOpen = () => {
      const launcher = resolveWidgetLauncher();
      if (!launcher) return false;
      launcher.click();
      markChatOpened();
      return true;
    };

    if (tryOpen()) return;
    window.setTimeout(() => {
      tryOpen();
    }, 300);
    window.setTimeout(() => {
      tryOpen();
    }, 800);
  }, [markChatOpened, resolveWidgetLauncher]);

  useEffect(() => {
    if (preview || !chatGlowEnabled) {
      setGlowActive(false);
      return;
    }
    if (typeof window === "undefined") return;
    let hasOpened = false;
    try {
      hasOpened = Boolean(window.sessionStorage.getItem(CHAT_OPENED_SESSION_KEY));
    } catch {
      hasOpened = false;
    }
    if (hasOpened) {
      setGlowActive(false);
      return;
    }
    setGlowActive(true);
    const timer = window.setTimeout(() => {
      setGlowActive(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [chatGlowEnabled, preview]);

  useEffect(() => {
    if (preview || !chatGlowEnabled) {
      updateGlowClasses(false);
      return;
    }
    if (!glowActive) {
      updateGlowClasses(false);
      return;
    }

    let interval: number | null = null;
    const apply = () => {
      if (typeof document === "undefined") return false;
      const container = document.getElementById("promptly-widget");
      if (!container) return false;
      container.classList.add(...glowClasses);
      return true;
    };

    if (!apply()) {
      interval = window.setInterval(() => {
        if (apply() && interval) {
          window.clearInterval(interval);
          interval = null;
        }
      }, 200);
    }

    return () => {
      if (interval) window.clearInterval(interval);
      updateGlowClasses(false);
    };
  }, [chatGlowEnabled, glowActive, glowClasses, preview, updateGlowClasses]);

  useEffect(() => {
    if (preview) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "promptly-widget-resize") return;
      if (event.data?.open) {
        markChatOpened();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [markChatOpened, preview]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "section:highlight") {
        const sectionId = event.data.sectionId as string | null;
        const nodes = document.querySelectorAll("[data-section-id]");
        nodes.forEach((node) => {
          const element = node as HTMLElement;
          element.style.outline = "";
          element.style.outlineOffset = "";
        });
        if (!sectionId) return;
        const active = document.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null;
        if (active) {
          active.style.outline = "2px solid var(--site-primary)";
          active.style.outlineOffset = "6px";
          active.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
      if (event.data?.type === "element:highlight") {
        const elementId = event.data.elementId as string | null;
        const nodes = document.querySelectorAll("[data-element-id]");
        nodes.forEach((node) => {
          const element = node as HTMLElement;
          element.style.outline = "";
          element.style.outlineOffset = "";
        });
        if (!elementId) return;
        const active = document.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement | null;
        if (active) {
          active.style.outline = "2px solid var(--site-primary)";
          active.style.outlineOffset = "4px";
          active.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (!analyticsContext?.enabled) return;
    if (typeof window === "undefined") return;
    if (!analyticsContext.pagePath) return;
    if (!analyticsContext.businessId && !analyticsContext.siteId) return;

    const key = `sc_page_view:${analyticsContext.siteId ?? "site"}:${analyticsContext.pagePath}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // ignore storage errors
    }

    trackPageView({
      businessId: analyticsContext.businessId,
      siteId: analyticsContext.siteId,
      pagePath: analyticsContext.pagePath,
      pageTitle: analyticsContext.pageTitle ?? null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null
    });
  }, [analyticsContext]);

  useEffect(() => {
    const scripts: Array<{ key: string; src?: string; code?: string; placement?: "head" | "body" }> = [];
    const customHead = site.customCode?.head?.trim();
    const customBody = site.customCode?.body?.trim();

    if (customHead) {
      scripts.push({ key: "custom-head", code: customHead, placement: "head" });
    }
    if (customBody) {
      scripts.push({ key: "custom-body", code: customBody, placement: "body" });
    }

    (site.apps ?? [])
      .filter((app) => app.enabled)
      .forEach((app) => {
        if (app.id === "live-chat") {
          const script = app.config?.script as string | undefined;
          const src = app.config?.src as string | undefined;
          if (script || src) {
            scripts.push({ key: `app-${app.id}`, code: script, src, placement: "body" });
          }
        }
        if (app.id === "analytics") {
          const measurementId = app.config?.measurementId as string | undefined;
          const script = app.config?.script as string | undefined;
          if (measurementId) {
            scripts.push({
              key: `app-${app.id}-gtag`,
              src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
              placement: "head"
            });
            scripts.push({
              key: `app-${app.id}-inline`,
              code: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${measurementId}');`,
              placement: "head"
            });
          } else if (script) {
            scripts.push({ key: `app-${app.id}`, code: script, placement: "head" });
          }
        }
        if (app.id === "booking-widget") {
          const script = app.config?.script as string | undefined;
          const src = app.config?.src as string | undefined;
          if (script || src) {
            scripts.push({ key: `app-${app.id}`, code: script, src, placement: "body" });
          }
        }
      });

    scripts.forEach((payload) => {
      if (typeof document === "undefined") return;
      const selector = `script[data-site-script="${payload.key}"]`;
      if (document.querySelector(selector)) return;
      const script = document.createElement("script");
      script.setAttribute("data-site-script", payload.key);
      if (payload.src) {
        script.src = payload.src;
        script.async = true;
      }
      if (payload.code) {
        script.textContent = payload.code;
      }
      const target = payload.placement === "head" ? document.head : document.body;
      target.appendChild(script);
    });
  }, [site.apps, site.customCode]);

  return (
    <div
      style={{ ...themeVars, fontFamily: "var(--site-fontBody)" }}
      className="min-h-screen overflow-x-hidden bg-[color:var(--site-bg)] text-[color:var(--site-text)]"
    >
      <style jsx global>{`
        @keyframes site-fade {
          from {
            opacity: 0.2;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes site-slide {
          from {
            opacity: 0.2;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <ChatPromptTopBar
        enabled={!preview && chatPromptEnabled}
        text={site.chat_prompt_topbar_text}
        ctaLabel={site.chat_prompt_topbar_cta}
        onOpenChat={openChat}
      />
      <header className={renderDNA.chrome.headerClassName}>
        <div className={renderDNA.chrome.containerClassName}>
          <button
            type="button"
            onClick={() => handleNavigate(site.pages?.[0]?.slug ?? "home")}
            className={renderDNA.chrome.brandClassName}
            style={{ fontFamily: "var(--site-fontHeading)" }}
          >
            {brandLogoUrl ? (
              <span className={`mr-3 inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ${renderDNA.chrome.badgeClassName}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandLogoUrl}
                  alt={`${site.siteBrief?.businessName ?? "Business"} logo`}
                  className="h-10 w-10 object-contain"
                />
              </span>
            ) : null}
            <span className="inline-flex items-center">
              {site.siteBrief?.businessName ?? site.pages?.[0]?.name ?? "Site"}
            </span>
          </button>
          <nav className={renderDNA.chrome.navClassName}>
            {(menuTree.get(null) ?? []).map((page) => {
              const children = menuTree.get(page.id) ?? [];
              return (
                <div key={page.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => handleNavigate(page.slug)}
                    className={`transition ${page.slug === activePage?.slug ? activeNavClass : inactiveNavClass}`}
                  >
                    {page.menuTitle ?? page.name}
                  </button>
                  {children.length ? (
                    <div className="absolute left-0 top-full z-20 hidden min-w-[180px] rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-2 shadow-lg group-hover:block">
                      {children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => handleNavigate(child.slug)}
                          className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--site-muted)] hover:text-[color:var(--site-text)]"
                        >
                          {child.menuTitle ?? child.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          <div className="flex items-center justify-start gap-3 md:justify-end">
            {contactPhoneRaw && contactPhoneHref ? (
              <a
                href={contactPhoneHref}
                className={phoneClassName}
              >
                {contactPhoneRaw}
              </a>
            ) : null}
            <a
              href="#contact"
              className={renderButtonClass(site, "solid")}
            >
              {primaryHeaderCtaLabel}
            </a>
          </div>
        </div>
      </header>
      <div key={activePage?.id} className={transitionClass}>
        {sections
          .filter((section) => section.enabled)
          .map((section) => (
            <div key={section.id} data-section-shell-id={section.id}>
              {renderSection(section, { theme: site.theme, site, analytics: analyticsContext, preview })}
            </div>
          ))}
      </div>
    </div>
  );
}
