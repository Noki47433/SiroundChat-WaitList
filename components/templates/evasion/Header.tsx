"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import styles from "@/components/templates/evasion/evasion.module.css";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";

type HeaderProps = {
  brand: string;
  logoUrl?: string | null;
  data: EvasionTemplateData["header"];
};

export function Header({ brand, logoUrl, data }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed left-1/2 top-4 z-50 w-[90%] max-w-3xl -translate-x-1/2 transition-all duration-300 ${
        isScrolled ? "rounded-full bg-[var(--evasion-bg)]/85 backdrop-blur-md" : "bg-transparent"
      }`}
      style={{ boxShadow: isScrolled ? "var(--evasion-shadow)" : "none" }}
    >
      <div className="flex items-center justify-between px-2 py-2 pl-5 transition-all duration-300">
        <Link
          href="#top"
          className={`flex items-center gap-3 text-lg font-medium tracking-tight transition-colors duration-300 ${
            isScrolled ? "text-[var(--evasion-text)]" : "text-[var(--site-primary-foreground)]"
          }`}
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${brand} logo`}
              width={36}
              height={36}
              unoptimized
              className="h-9 w-9 object-contain"
            />
          ) : null}
          {brand}
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          {data.navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm transition-colors ${
                isScrolled ? "text-[var(--evasion-muted)] hover:text-[var(--evasion-text)]" : ""
              }`}
              style={
                isScrolled
                  ? undefined
                  : {
                      color: "color-mix(in srgb, var(--site-primary-foreground, #ffffff) 72%, transparent)"
                    }
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-6 md:flex">
          <Link
            href={data.ctaHref}
            data-editor-button="true"
            className="rounded-full px-4 py-2 text-sm font-medium transition-all hover:opacity-90"
            style={{
              background: "var(--evasion-accent)",
              color: "var(--site-primary-foreground)"
            }}
          >
            {data.ctaLabel}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((value) => !value)}
          className={`md:hidden ${isScrolled ? "text-[var(--evasion-text)]" : "text-[var(--site-primary-foreground)]"}`}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMenuOpen ? (
        <div className={`${styles.root} rounded-b-2xl border-t border-[var(--evasion-border)] bg-[var(--evasion-bg)] px-6 py-8 md:hidden`}>
          <nav className="flex flex-col gap-6">
            {data.navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-lg text-[var(--evasion-text)]"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={data.ctaHref}
              data-editor-button="true"
              className="mt-4 rounded-full px-5 py-3 text-center text-sm font-medium"
              style={{
                background: "var(--evasion-accent)",
                color: "var(--site-primary-foreground)"
              }}
              onClick={() => setIsMenuOpen(false)}
            >
              {data.ctaLabel}
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
