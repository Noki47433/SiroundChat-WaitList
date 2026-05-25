"use client";

import Link from "next/link";
import { useState } from "react";
import {
  buildIntegratedTemplateCssVarsFromTheme,
  buildIntegratedTemplateTheme
} from "@/lib/builder/template-sites/palette";
import type {
  IntegratedPageBlock,
  IntegratedTemplatePage,
  IntegratedTemplateSiteDocument
} from "@/lib/builder/template-sites/schema";
import editorStyles from "@/components/templates/template-editor.module.css";
import type { CSSProperties } from "react";

type Props = {
  document: IntegratedTemplateSiteDocument;
  page: IntegratedTemplatePage;
  siteId?: string | null;
};

// ─── Content type helpers ─────────────────────────────────────────────────────

type MenuCategory = { id: string; label: string; items: MenuItem[] };
type MenuItem = { title: string; description?: string; price?: string };
type CardItem = { title: string; description?: string; price?: string; [k: string]: unknown };
type FaqItem = { question: string; answer: string };

const str = (v: unknown, fallback = "") =>
  typeof v === "string" && v.trim() ? v.trim() : fallback;

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

// ─── Block renderers ──────────────────────────────────────────────────────────

function HeroBlock({ content }: { content: Record<string, unknown> }) {
  return (
    <section className="py-20 px-6 text-center" style={{ background: "var(--site-background, #0a0a0a)" }}>
      <div className="mx-auto max-w-3xl">
        <h1
          className="mb-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl"
          style={{ color: "var(--site-text, #fff)" }}
        >
          {str(content.heading, "Welcome")}
        </h1>
        {content.subheading ? (
          <p
            className="mb-8 text-lg leading-relaxed"
            style={{ color: "var(--site-text-soft, rgba(255,255,255,0.72))" }}
          >
            {str(content.subheading)}
          </p>
        ) : null}
        {content.ctaLabel && content.ctaHref ? (
          <a
            href={str(content.ctaHref)}
            className="inline-block rounded-lg px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-85"
            style={{
              background: "var(--site-primary, #c9a96e)",
              color: "var(--site-primary-foreground, #fff)"
            }}
          >
            {str(content.ctaLabel)}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function TextBlock({ content }: { content: Record<string, unknown> }) {
  return (
    <section className="py-16 px-6">
      <div className="mx-auto max-w-3xl">
        {content.heading ? (
          <h2
            className="mb-6 text-2xl font-semibold tracking-tight md:text-3xl"
            style={{ color: "var(--site-text, #fff)" }}
          >
            {str(content.heading)}
          </h2>
        ) : null}
        <p
          className="text-base leading-8"
          style={{ color: "var(--site-text-soft, rgba(255,255,255,0.72))" }}
        >
          {str(content.body)}
        </p>
      </div>
    </section>
  );
}

function MenuGridBlock({ content }: { content: Record<string, unknown> }) {
  const categories = arr<MenuCategory>(content.categories);
  return (
    <section className="py-16 px-6">
      <div className="mx-auto max-w-5xl">
        {content.heading ? (
          <h2
            className="mb-12 text-center text-2xl font-semibold tracking-tight md:text-3xl"
            style={{ color: "var(--site-text, #fff)" }}
          >
            {str(content.heading)}
          </h2>
        ) : null}
        <div className="space-y-12">
          {categories.map((cat) => (
            <div key={cat.id ?? cat.label}>
              <h3
                className="mb-6 border-b pb-3 text-sm font-semibold uppercase tracking-widest"
                style={{
                  color: "var(--site-primary, #c9a96e)",
                  borderColor: "var(--site-border, rgba(255,255,255,0.1))"
                }}
              >
                {cat.label}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {arr<MenuItem>(cat.items).map((item, idx) => (
                  <div
                    key={`${cat.id}-${idx}`}
                    className="flex items-start justify-between gap-4 rounded-xl p-4"
                    style={{ background: "var(--site-surface, rgba(255,255,255,0.04))" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium leading-snug"
                        style={{ color: "var(--site-text, #fff)" }}
                      >
                        {item.title}
                      </p>
                      {item.description ? (
                        <p
                          className="mt-1 text-sm leading-6"
                          style={{ color: "var(--site-text-soft, rgba(255,255,255,0.6))" }}
                        >
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                    {item.price ? (
                      <span
                        className="shrink-0 text-sm font-semibold"
                        style={{ color: "var(--site-primary, #c9a96e)" }}
                      >
                        {item.price}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCardsBlock({ content }: { content: Record<string, unknown> }) {
  const items = arr<CardItem>(content.items);
  return (
    <section className="py-16 px-6">
      <div className="mx-auto max-w-5xl">
        {content.heading ? (
          <h2
            className="mb-10 text-center text-2xl font-semibold tracking-tight md:text-3xl"
            style={{ color: "var(--site-text, #fff)" }}
          >
            {str(content.heading)}
          </h2>
        ) : null}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl p-6"
              style={{
                background: "var(--site-surface, rgba(255,255,255,0.04))",
                border: "1px solid var(--site-border, rgba(255,255,255,0.08))"
              }}
            >
              <h3
                className="mb-2 font-semibold"
                style={{ color: "var(--site-text, #fff)" }}
              >
                {str(item.title)}
              </h3>
              {item.description ? (
                <p
                  className="text-sm leading-6"
                  style={{ color: "var(--site-text-soft, rgba(255,255,255,0.65))" }}
                >
                  {str(item.description)}
                </p>
              ) : null}
              {item.price ? (
                <p
                  className="mt-3 text-sm font-semibold"
                  style={{ color: "var(--site-primary, #c9a96e)" }}
                >
                  {str(item.price)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqListBlock({ content }: { content: Record<string, unknown> }) {
  const items = arr<FaqItem>(content.items);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-16 px-6">
      <div className="mx-auto max-w-3xl">
        {content.heading ? (
          <h2
            className="mb-10 text-2xl font-semibold tracking-tight md:text-3xl"
            style={{ color: "var(--site-text, #fff)" }}
          >
            {str(content.heading)}
          </h2>
        ) : null}
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-xl"
              style={{
                background: "var(--site-surface, rgba(255,255,255,0.04))",
                border: "1px solid var(--site-border, rgba(255,255,255,0.08))"
              }}
            >
              <button
                className="flex w-full items-center justify-between px-5 py-4 text-left"
                onClick={() => setOpen(open === idx ? null : idx)}
              >
                <span
                  className="text-sm font-medium leading-snug"
                  style={{ color: "var(--site-text, #fff)" }}
                >
                  {item.question}
                </span>
                <span
                  className="ml-4 shrink-0 text-lg leading-none transition-transform"
                  style={{
                    color: "var(--site-text-soft, rgba(255,255,255,0.5))",
                    transform: open === idx ? "rotate(45deg)" : "rotate(0deg)"
                  }}
                >
                  +
                </span>
              </button>
              {open === idx ? (
                <div className="px-5 pb-5">
                  <p
                    className="text-sm leading-7"
                    style={{ color: "var(--site-text-soft, rgba(255,255,255,0.65))" }}
                  >
                    {item.answer}
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GalleryGridBlock({ content }: { content: Record<string, unknown> }) {
  return (
    <section className="py-16 px-6">
      <div className="mx-auto max-w-5xl">
        {content.heading ? (
          <h2
            className="mb-10 text-center text-2xl font-semibold tracking-tight"
            style={{ color: "var(--site-text, #fff)" }}
          >
            {str(content.heading)}
          </h2>
        ) : null}
        {content.note ? (
          <p
            className="text-center text-sm"
            style={{ color: "var(--site-text-soft, rgba(255,255,255,0.55))" }}
          >
            {str(content.note)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function CardListBlock({
  content,
  fields
}: {
  content: Record<string, unknown>;
  fields: string[];
}) {
  const items = arr<CardItem>(content.items);
  return (
    <section className="py-16 px-6">
      <div className="mx-auto max-w-5xl">
        {content.heading ? (
          <h2
            className="mb-10 text-center text-2xl font-semibold tracking-tight md:text-3xl"
            style={{ color: "var(--site-text, #fff)" }}
          >
            {str(content.heading)}
          </h2>
        ) : null}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl p-6"
              style={{
                background: "var(--site-surface, rgba(255,255,255,0.04))",
                border: "1px solid var(--site-border, rgba(255,255,255,0.08))"
              }}
            >
              <h3
                className="mb-2 font-semibold"
                style={{ color: "var(--site-text, #fff)" }}
              >
                {str(item.title)}
              </h3>
              {item.description ? (
                <p
                  className="mb-3 text-sm leading-6"
                  style={{ color: "var(--site-text-soft, rgba(255,255,255,0.65))" }}
                >
                  {str(item.description)}
                </p>
              ) : null}
              {fields.map((f) =>
                item[f] ? (
                  <p
                    key={f}
                    className="text-sm font-medium"
                    style={{ color: "var(--site-primary, #c9a96e)" }}
                  >
                    {str(item[f])}
                  </p>
                ) : null
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBlock({ content }: { content: Record<string, unknown> }) {
  return (
    <section className="py-20 px-6">
      <div
        className="mx-auto max-w-2xl rounded-3xl p-10 text-center"
        style={{ background: "var(--site-surface, rgba(255,255,255,0.06))" }}
      >
        <h2
          className="mb-4 text-2xl font-bold tracking-tight md:text-3xl"
          style={{ color: "var(--site-text, #fff)" }}
        >
          {str(content.heading)}
        </h2>
        {content.body ? (
          <p
            className="mb-8 leading-7"
            style={{ color: "var(--site-text-soft, rgba(255,255,255,0.7))" }}
          >
            {str(content.body)}
          </p>
        ) : null}
        {content.ctaLabel && content.ctaHref ? (
          <a
            href={str(content.ctaHref)}
            className="inline-block rounded-lg px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-85"
            style={{
              background: "var(--site-primary, #c9a96e)",
              color: "var(--site-primary-foreground, #fff)"
            }}
          >
            {str(content.ctaLabel)}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function ContactBlock({ content }: { content: Record<string, unknown> }) {
  const addressLines = arr<string>(content.addressLines);
  const hours = arr<string>(content.hours);
  return (
    <section className="py-16 px-6">
      <div className="mx-auto max-w-3xl">
        {content.heading ? (
          <h2
            className="mb-8 text-2xl font-semibold tracking-tight"
            style={{ color: "var(--site-text, #fff)" }}
          >
            {str(content.heading)}
          </h2>
        ) : null}
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            {content.phone ? (
              <p className="mb-2 text-sm" style={{ color: "var(--site-text-soft, rgba(255,255,255,0.65))" }}>
                {str(content.phone)}
              </p>
            ) : null}
            {content.email ? (
              <p className="mb-2 text-sm" style={{ color: "var(--site-text-soft, rgba(255,255,255,0.65))" }}>
                {str(content.email)}
              </p>
            ) : null}
            {addressLines.map((line, i) => (
              <p key={i} className="text-sm" style={{ color: "var(--site-text-soft, rgba(255,255,255,0.65))" }}>
                {line}
              </p>
            ))}
          </div>
          {hours.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--site-primary, #c9a96e)" }}>
                Hours
              </p>
              {hours.map((h, i) => (
                <p key={i} className="text-sm" style={{ color: "var(--site-text-soft, rgba(255,255,255,0.65))" }}>
                  {h}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PageBlock({ block }: { block: IntegratedPageBlock }) {
  if (!block.enabled) return null;
  const c = block.content;
  switch (block.kind) {
    case "hero":          return <HeroBlock content={c} />;
    case "text":          return <TextBlock content={c} />;
    case "menu_grid":     return <MenuGridBlock content={c} />;
    case "service_cards": return <ServiceCardsBlock content={c} />;
    case "gallery_grid":  return <GalleryGridBlock content={c} />;
    case "faq_list":      return <FaqListBlock content={c} />;
    case "cta":           return <CtaBlock content={c} />;
    case "contact":       return <ContactBlock content={c} />;
    case "property_cards":
      return <CardListBlock content={c} fields={["price", "location", "beds", "baths"]} />;
    case "car_cards":
      return <CardListBlock content={c} fields={["price", "year", "mileage"]} />;
    case "room_cards":
      return <CardListBlock content={c} fields={["price", "amenities"]} />;
    default:
      return null;
  }
}

// ─── Navigation bar ───────────────────────────────────────────────────────────

function PageNav({
  brandName,
  logoUrl,
  navItems
}: {
  brandName: string;
  logoUrl?: string | null;
  navItems: Array<{ label: string; href: string }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <nav
      className="sticky top-0 z-50 px-6 py-4"
      style={{
        background: "var(--site-background, #0a0a0a)",
        borderBottom: "1px solid var(--site-border, rgba(255,255,255,0.08))"
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6">
        <Link
          href="."
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--site-text, #fff)" }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName} className="h-7 w-auto object-contain" />
          ) : null}
          <span>{brandName}</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm transition-opacity hover:opacity-70"
              style={{ color: "var(--site-text-soft, rgba(255,255,255,0.7))" }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span
            className="h-px w-5 transition-transform"
            style={{
              background: "var(--site-text, #fff)",
              transform: open ? "rotate(45deg) translate(2px, 2px)" : "none"
            }}
          />
          <span
            className="h-px w-5 transition-opacity"
            style={{
              background: "var(--site-text, #fff)",
              opacity: open ? 0 : 1
            }}
          />
          <span
            className="h-px w-5 transition-transform"
            style={{
              background: "var(--site-text, #fff)",
              transform: open ? "rotate(-45deg) translate(2px, -2px)" : "none"
            }}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {open ? (
        <div
          className="mt-3 flex flex-col gap-1 rounded-xl p-3 md:hidden"
          style={{ background: "var(--site-surface, rgba(255,255,255,0.05))" }}
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ color: "var(--site-text-soft, rgba(255,255,255,0.75))" }}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export function IntegratedAdditionalPageRenderer({ document, page, siteId: _siteId }: Props) {
  const settings = document.editorSettings;
  const resolvedTheme = buildIntegratedTemplateTheme(
    document.template,
    settings?.colors?.primaryColor ?? document.theme?.primaryColor ?? null,
    settings?.colors?.secondaryColor ?? document.theme?.secondaryColor ?? null
  );

  const cssVars = buildIntegratedTemplateCssVarsFromTheme(document.template, resolvedTheme);

  const style: CSSProperties = {
    ...cssVars,
    fontFamily: settings?.typography
      ? undefined
      : "inherit",
    minHeight: "100vh"
  };

  // Build nav items: homepage anchor + any document navigationItems pointing to pages
  const brandData = document.data as Record<string, unknown> | null;
  const brandName = str(
    (brandData as any)?.brand ?? document.meta.businessName,
    document.meta.businessName
  );
  const logoUrl = str((brandData as any)?.logoUrl ?? null) || null;

  const navItems: Array<{ label: string; href: string }> = [
    { label: brandName, href: "." }, // "back home" — use brand name itself
    ...(document.navigationItems ?? [])
      .filter((n) => n.enabled)
      .sort((a, b) => a.order - b.order)
      .map((n) => ({ label: n.label, href: n.href }))
  ];

  return (
    <div style={style} className={editorStyles.root}>
      <PageNav brandName={brandName} logoUrl={logoUrl} navItems={navItems} />
      {page.blocks.map((block) => (
        <PageBlock key={block.id} block={block} />
      ))}
    </div>
  );
}
