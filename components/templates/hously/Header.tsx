"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";

import { HouslyWordmark } from "@/components/templates/hously/HouslyWordmark";
import type { HouslyTemplateData } from "@/components/templates/hously/data";
import { cn } from "@/lib/utils/cn";

type HeaderProps = {
  brand: string;
  logoUrl?: string | null;
  data: HouslyTemplateData["header"];
};

export function Header({ brand, logoUrl, data }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className={cn(
        "fixed left-0 right-0 z-50 my-0 rounded-none py-0 transition-all duration-500",
        scrolled || mobileMenuOpen
          ? "left-4 right-4 top-4 rounded-2xl py-4 backdrop-blur-md"
          : "left-0 right-0 top-0 py-4"
      )}
      style={{
        background:
          scrolled || mobileMenuOpen ? "color-mix(in srgb, var(--site-surface, #111315) 92%, transparent)" : "transparent"
      }}
    >
      <nav className="container mx-auto flex items-center justify-between px-6 md:px-6">
        <div className="flex items-center gap-2">
          <HouslyWordmark brand={brand} logoUrl={logoUrl} />
        </div>

        <ul className="hidden items-center gap-10 text-sm tracking-wide md:flex">
          {data.navItems.map((item) => (
            <li key={item.label}>
                <Link
                  href={item.href}
                  className="relative transition-colors duration-300 hover:text-[var(--hously-accent)] after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-[var(--hously-accent)] after:transition-all after:duration-300 hover:after:w-full"
                  style={{ color: "var(--site-primary-foreground, #ffffff)" }}
                >
                  {item.label}
                </Link>
            </li>
          ))}
        </ul>

        <Link
          href={data.ctaHref}
          data-editor-button="true"
          className="hidden items-center gap-2 border px-5 py-2.5 text-sm transition-all duration-300 hover:brightness-105 md:inline-flex"
          style={{
            background: "var(--hously-primary)",
            color: "var(--hously-primary-foreground)",
            borderColor: "var(--hously-primary)"
          }}
        >
          {data.ctaLabel}
        </Link>

        <button
          className="z-50 transition-colors duration-300 md:hidden"
          style={{ color: "var(--site-primary-foreground, #ffffff)" }}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          type="button"
          onClick={() => setMobileMenuOpen((value) => !value)}
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="4" y1="8" x2="20" y2="8" />
              <line x1="4" y1="16" x2="20" y2="16" />
            </svg>
          )}
        </button>
      </nav>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out md:hidden",
          mobileMenuOpen ? "mt-8 max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="container mx-auto px-6">
          <ul className="mb-8 flex flex-col gap-6">
            {data.navItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="block text-4xl font-light transition-colors duration-300 hover:text-[var(--hously-accent)]"
                  style={{ color: "var(--site-primary-foreground, #ffffff)" }}
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href={data.ctaHref}
            data-editor-button="true"
            className="mb-4 inline-flex items-center justify-center gap-2 border px-5 py-2.5 text-sm transition-all duration-300 hover:brightness-105"
            style={{
              background: "var(--hously-primary)",
              color: "var(--hously-primary-foreground)",
              borderColor: "var(--hously-primary)"
            }}
            onClick={closeMobileMenu}
          >
            {data.ctaLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
