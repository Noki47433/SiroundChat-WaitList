"use client";

import type { CSSProperties } from "react";
import type { SiteContent } from "@/lib/builder/types";
import { ContactForm, ReservationForm } from "@/components/website-builder/SiteForms";

type TemplateProps = {
  content: SiteContent;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
  logoUrl?: string | null;
  siteSlug?: string | null;
  siteId?: string | null;
  preview?: boolean;
};

export function RestaurantTemplate({
  content,
  primaryColor,
  secondaryColor,
  fontFamily,
  logoUrl,
  siteSlug,
  siteId,
  preview
}: TemplateProps) {
  const themeStyle: CSSProperties = {
    ["--site-primary" as any]: primaryColor ?? "#111827",
    ["--site-secondary" as any]: secondaryColor ?? "#FFFFFF",
    ["--site-bg" as any]: secondaryColor ?? "#FFF7E6",
    ["--site-text" as any]: "#1F1300",
    ["--site-muted" as any]: "rgba(31, 19, 0, 0.7)",
    ["--site-surface" as any]: "#FFFFFF",
    ["--site-border" as any]: "rgba(31, 19, 0, 0.12)",
    ["--site-buttonText" as any]: "#1F1300"
  };

  return (
    <div
      className="min-h-screen bg-[color:var(--site-bg)] text-[color:var(--site-text)]"
      style={{ ...themeStyle, fontFamily: fontFamily || "Sora, system-ui, sans-serif" }}
    >
      <header className="sticky top-0 z-10 border-b border-[color:var(--site-border)] bg-[color:var(--site-bg)]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-10 w-10 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] object-contain p-1"
                />
              </>
            ) : null}
            <div>
              <span className="text-sm font-semibold">{content.hero.headline}</span>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--site-muted)]">
                Local kitchen
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-5 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--site-muted)] md:flex">
            {content.menu ? <a href="#menu">Menu</a> : null}
            {content.reservation?.enabled ? <a href="#reservation">Reservations</a> : null}
            <a href="#contact">Contact</a>
          </div>
          <a
            href={content.hero.ctaHref}
            className="rounded-full bg-[color:var(--site-primary)] px-4 py-2 text-xs font-semibold text-[color:var(--site-buttonText)]"
          >
            {content.hero.ctaLabel}
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--site-muted)]">
                Chef-driven dining
              </p>
              <h1 className="text-4xl font-semibold">{content.hero.headline}</h1>
              <p className="text-base text-[color:var(--site-muted)]">{content.hero.subheadline}</p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={content.hero.ctaHref}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[color:var(--site-primary)] px-5 text-sm font-semibold text-[color:var(--site-buttonText)]"
                >
                  {content.hero.ctaLabel}
                </a>
                {content.menu ? (
                  <a
                    href="#menu"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-[color:var(--site-border)] px-5 text-sm font-semibold"
                  >
                    Explore menu
                  </a>
                ) : null}
              </div>
            </div>
            <div className="rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-6 shadow-soft">
              <h2 className="text-xl font-semibold">{content.about.title}</h2>
              <p className="mt-3 text-sm text-[color:var(--site-muted)]">{content.about.body}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-10">
          <h2 className="text-2xl font-semibold">{content.services.title}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {content.services.items.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5 shadow-soft"
              >
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--site-muted)]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {content.gallery ? (
          <section className="mx-auto w-full max-w-6xl px-6 py-10">
            <h2 className="text-2xl font-semibold">{content.gallery.title}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {content.gallery.images.map((image) => {
                return (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={image.url}
                    src={image.url}
                    alt={image.alt}
                    className="h-48 w-full rounded-2xl object-cover"
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {content.menu ? (
          <section className="mx-auto w-full max-w-6xl px-6 py-10" id="menu">
            <h2 className="text-2xl font-semibold">{content.menu.title}</h2>
            <div className="mt-6 grid gap-4">
              {content.menu.items.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-5 shadow-soft"
                >
                  <div>
                    <h3 className="text-sm font-semibold">{item.name}</h3>
                    <p className="mt-2 text-sm text-[color:var(--site-muted)]">{item.description}</p>
                  </div>
                  {item.price ? <span className="text-sm font-semibold">{item.price}</span> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {content.reservation?.enabled ? (
          <section className="mx-auto w-full max-w-6xl px-6 py-10" id="reservation">
            <div className="rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-6 shadow-soft">
              <h2 className="text-2xl font-semibold">{content.reservation.title}</h2>
              <p className="mt-2 text-sm text-[color:var(--site-muted)]">{content.reservation.description}</p>
              <div className="mt-6">
                <ReservationForm siteSlug={siteSlug} siteId={siteId} mode={preview ? "preview" : "live"} />
              </div>
            </div>
          </section>
        ) : null}

        <section className="mx-auto w-full max-w-6xl px-6 py-12" id="contact">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <div>
              <h2 className="text-2xl font-semibold">{content.contact.title}</h2>
              <p className="mt-2 text-sm text-[color:var(--site-muted)]">{content.contact.body}</p>
              <div className="mt-4 space-y-3 text-sm text-[color:var(--site-muted)]">
                {content.contact.email ? <p>Email: {content.contact.email}</p> : null}
                {content.contact.phone ? <p>Phone: {content.contact.phone}</p> : null}
                {content.contact.address ? <p>Address: {content.contact.address}</p> : null}
              </div>
            </div>
            <div className="rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-6 shadow-soft">
              <ContactForm siteSlug={siteSlug} siteId={siteId} mode={preview ? "preview" : "live"} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--site-border)] bg-[color:var(--site-surface)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-[color:var(--site-muted)]">
          <span>{content.footer.text}</span>
          <span>SiroundChat</span>
        </div>
      </footer>
    </div>
  );
}
