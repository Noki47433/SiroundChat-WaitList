"use client";

import Link from "next/link";
import styles from "@/components/templates/essence/essence.module.css";
import type { EssenceTemplateData } from "@/components/templates/essence/data";

type FooterProps = {
  brand: string;
  data: EssenceTemplateData["footer"];
};

export function Footer({ brand, data }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t py-16 md:py-24" style={{ borderColor: "var(--essence-border)" }}>
      <div className="mx-auto max-w-[1800px] px-6 md:px-12 lg:px-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-20">
          <div className="space-y-6 lg:col-span-4">
            <Link href="#top" className="inline-block">
              <span className={`${styles.serif} text-2xl font-light tracking-[0.2em] text-[var(--essence-foreground)] md:text-3xl`}>
                {brand}
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-[var(--essence-muted)]">{data.description}</p>
          </div>

          <div className="lg:col-span-2">
            <h4 className="mb-6 text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">Restaurant</h4>
            <nav className="space-y-4">
              {data.restaurantLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block text-sm text-[var(--site-text-soft)] transition-colors duration-300 hover:text-[var(--essence-foreground)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="lg:col-span-2">
            <h4 className="mb-6 text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">Legal</h4>
            <nav className="space-y-4">
              {data.legalLinks.map((item) => (
                <Link
                  key={item}
                  href="#"
                  className="block text-sm text-[var(--site-text-soft)] transition-colors duration-300 hover:text-[var(--essence-foreground)]"
                >
                  {item}
                </Link>
              ))}
            </nav>
          </div>

          <div className="lg:col-span-4">
            <h4 className="mb-6 text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">Get in Touch</h4>
            <div className="space-y-4">
              <p className="text-sm text-[var(--site-text-soft)]">
                {data.contactAddress[0]}
                <br />
                {data.contactAddress[1]}
              </p>
              <p className="text-sm">
                <a href={`mailto:${data.contactEmail}`} className="text-[var(--essence-foreground)] transition-colors duration-300 hover:text-[var(--essence-accent)]">
                  {data.contactEmail}
                </a>
              </p>
              <p className="text-sm">
                <a href={`tel:${data.contactPhone.replace(/[^\d+]/g, "")}`} className="text-[var(--site-text-soft)] transition-colors duration-300 hover:text-[var(--essence-foreground)]">
                  {data.contactPhone}
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-6 border-t pt-8 md:mt-24 md:flex-row" style={{ borderColor: "var(--essence-border)" }}>
          <p className="text-xs text-[var(--essence-muted)]">© {currentYear} {brand}. All rights reserved.</p>

          <div className="flex items-center gap-8">
            {data.socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs uppercase tracking-[0.1em] text-[var(--essence-muted)] transition-colors duration-300 hover:text-[var(--essence-foreground)]"
              >
                {social.label}
              </a>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="group flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-[var(--essence-muted)] transition-colors duration-300 hover:text-[var(--essence-foreground)]"
          >
            <span>Back to top</span>
            <svg className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>

        <div className="mt-16 overflow-hidden md:mt-24">
          <p
            className={`${styles.serif} whitespace-nowrap text-[8vw] leading-none tracking-[-0.02em] md:text-[6vw] lg:text-[5vw]`}
            style={{ color: "color-mix(in srgb, var(--essence-accent) 16%, transparent)" }}
          >
            {data.decorativeQuote}
          </p>
        </div>
      </div>
    </footer>
  );
}
