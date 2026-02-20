"use client";

import type { CSSProperties } from "react";
import type { SiteContent } from "@/lib/builder/types";
import { ContactForm, ReservationForm } from "@/components/website-builder/SiteForms";

const buildContactRows = (content: SiteContent["contact"]) => {
  const rows = [] as Array<{ label: string; value: string }>;
  if (content.email) rows.push({ label: "Email", value: content.email });
  if (content.phone) rows.push({ label: "Phone", value: content.phone });
  if (content.address) rows.push({ label: "Address", value: content.address });
  return rows;
};

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

export function GenericTemplate({
  content,
  primaryColor,
  secondaryColor,
  fontFamily,
  logoUrl,
  siteSlug,
  siteId,
  preview
}: TemplateProps) {
  const contactRows = buildContactRows(content.contact);
  const themeStyle: CSSProperties = {
    ["--site-primary" as any]: primaryColor ?? "#111827",
    ["--site-secondary" as any]: secondaryColor ?? "#FFFFFF",
    ["--site-bg" as any]: secondaryColor ?? "#FFFDF7",
    ["--site-text" as any]: "#111827",
    ["--site-muted" as any]: "rgba(17, 24, 39, 0.7)",
    ["--site-surface" as any]: "#FFFFFF",
    ["--site-border" as any]: "rgba(17, 24, 39, 0.12)",
    ["--site-buttonText" as any]: "#FFFFFF"
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
            <span className="text-sm font-semibold">{content.hero.headline}</span>
          </div>
          <a
            href={content.hero.ctaHref}
            className="rounded-full border border-[color:var(--site-border)] px-4 py-2 text-xs font-semibold"
          >
            {content.hero.ctaLabel}
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--site-muted)]">
              Welcome
            </p>
            <h1 className="text-3xl font-semibold text-[color:var(--site-text)] md:text-4xl">
              {content.hero.headline}
            </h1>
            <p className="text-base text-[color:var(--site-muted)]">{content.hero.subheadline}</p>
            <a
              href={content.hero.ctaHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[color:var(--site-primary)] px-5 text-sm font-semibold text-[color:var(--site-buttonText)]"
            >
              {content.hero.ctaLabel}
            </a>
          </div>
          <div className="rounded-3xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-6 shadow-soft">
            <h2 className="text-xl font-semibold">{content.about.title}</h2>
            <p className="mt-3 text-sm text-[color:var(--site-muted)]">{content.about.body}</p>
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
          <section className="mx-auto w-full max-w-6xl px-6 py-10">
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
              <div className="mt-4 space-y-3">
                {contactRows.length ? (
                  contactRows.map((row) => (
                    <div key={row.label} className="text-sm text-[color:var(--site-muted)]">
                      <span className="font-semibold text-[color:var(--site-text)]">
                        {row.label}:
                      </span>{" "}
                      {row.value}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--site-muted)]">Reach out for more details.</p>
                )}
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
          <span>Powered by SiroundChat</span>
        </div>
      </footer>
    </div>
  );
}
