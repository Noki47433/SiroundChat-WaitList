"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import styles from "@/components/templates/essence/essence.module.css";
import type { EssenceTemplateData } from "@/components/templates/essence/data";

type HeaderProps = {
  brand: string;
  logoUrl?: string | null;
  data: EssenceTemplateData["header"];
};

export function Header({ brand, logoUrl, data }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-50 transition-all duration-700 ease-out",
        isScrolled ? "border-b bg-[var(--essence-bg)]/95 backdrop-blur-sm" : "bg-transparent"
      )}
      style={isScrolled ? { borderColor: "var(--essence-border)" } : undefined}
    >
      <div className="mx-auto max-w-[1800px] px-6 md:px-12 lg:px-20">
        <div className="flex h-20 items-center justify-between md:h-24">
          <Link href="#top" className="group relative">
            <span className="flex items-center gap-3">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={`${brand} logo`}
                  width={44}
                  height={44}
                  unoptimized
                  className="h-10 w-10 object-contain md:h-11 md:w-11"
                />
              ) : null}
              <span className={`${styles.serif} text-2xl font-light tracking-[0.2em] text-[var(--essence-foreground)] md:text-3xl`}>
                {brand}
              </span>
            </span>
            <span className="absolute -bottom-1 left-0 h-px w-0 transition-all duration-500 group-hover:w-full" style={{ background: "var(--essence-foreground)" }} />
          </Link>

          <nav className="hidden items-center gap-12 lg:flex">
            {data.navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group relative text-sm uppercase tracking-[0.15em] text-[var(--essence-muted)] transition-colors duration-300 hover:text-[var(--essence-foreground)]"
              >
                {item.label}
                <span
                  className="absolute -bottom-1 left-0 h-px w-0 transition-all duration-300 group-hover:w-full"
                  style={{ background: "var(--essence-accent)" }}
                />
              </Link>
            ))}
          </nav>

          <div className="hidden lg:block">
            <Link
              href={data.ctaHref}
              data-editor-button="true"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm uppercase tracking-[0.1em] transition-all duration-300 hover:opacity-90"
              style={{ background: "var(--essence-primary)", color: "var(--essence-primary-foreground)" }}
            >
              <span>{data.ctaLabel}</span>
              <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((value) => !value)}
            className="relative flex h-10 w-10 items-center justify-center lg:hidden"
            aria-label="Toggle menu"
          >
            <div className="flex flex-col gap-1.5">
              <span
                className={cn("h-px w-6 transition-all duration-300", isMobileMenuOpen && "translate-y-[4px] rotate-45")}
                style={{ background: "var(--essence-foreground)" }}
              />
              <span
                className={cn("h-px w-6 transition-all duration-300", isMobileMenuOpen && "-translate-y-[3px] -rotate-45")}
                style={{ background: "var(--essence-foreground)" }}
              />
            </div>
          </button>
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-0 transition-all duration-500 ease-out lg:hidden",
          isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        style={{ top: isScrolled ? "81px" : "80px", background: "var(--essence-bg)" }}
      >
        <nav className="flex h-full flex-col items-center justify-center gap-8 pb-20">
          {data.navItems.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`${styles.serif} text-2xl text-[var(--essence-foreground)] transition-colors duration-300 hover:text-[var(--essence-accent)]`}
              style={{
                transitionDelay: isMobileMenuOpen ? `${index * 50}ms` : "0ms",
                transform: isMobileMenuOpen ? "translateY(0)" : "translateY(20px)",
                opacity: isMobileMenuOpen ? 1 : 0,
                transition: "all 0.5s ease-out"
              }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={data.ctaHref}
            data-editor-button="true"
            onClick={() => setIsMobileMenuOpen(false)}
            className="mt-8 px-8 py-4 text-sm uppercase tracking-[0.1em]"
            style={{
              background: "var(--essence-primary)",
              color: "var(--essence-primary-foreground)",
              transitionDelay: isMobileMenuOpen ? `${data.navItems.length * 50}ms` : "0ms",
              transform: isMobileMenuOpen ? "translateY(0)" : "translateY(20px)",
              opacity: isMobileMenuOpen ? 1 : 0,
              transition: "all 0.5s ease-out"
            }}
          >
            Reserve Table
          </Link>
        </nav>
      </div>
    </header>
  );
}
