"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, MapPin, X } from "lucide-react";
import { useState } from "react";
import styles from "@/components/templates/food-truck/food-truck.module.css";
import type { FoodTruckLink } from "@/components/templates/food-truck/data";

interface HeaderProps {
  brand: {
    name: string;
    tagline: string;
    logoUrl?: string | null;
  };
  data: {
    links: FoodTruckLink[];
    locationLabel: string;
  };
}

export function Header({ brand, data }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-sm"
      style={{ borderColor: "var(--ft-border)", background: "color-mix(in srgb, var(--ft-bg) 86%, transparent)" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link href="#hero" className="flex items-center gap-3">
          {brand.logoUrl ? (
            <Image
              src={brand.logoUrl}
              alt={`${brand.name} logo`}
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 object-contain"
            />
          ) : null}
          <div>
            <p className={`${styles.display} text-xl font-bold uppercase tracking-[0.18em] text-[var(--ft-primary)] md:text-2xl`}>
              {brand.name}
            </p>
            <p className={`${styles.body} hidden text-[11px] uppercase tracking-[0.32em] text-[var(--ft-muted)] sm:block`}>
              {brand.tagline}
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {data.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.body} text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ft-text)] transition-colors hover:text-[var(--ft-primary)]`}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-2 text-[var(--ft-primary)]">
            <MapPin className="h-4 w-4" />
            <span className={`${styles.body} text-sm font-medium`}>{data.locationLabel}</span>
          </div>
        </nav>

        <button
          type="button"
          className="rounded-md p-2 text-[var(--ft-text)] transition-colors hover:text-[var(--ft-primary)] md:hidden"
          onClick={() => setIsOpen((value) => !value)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isOpen && (
        <nav
          className="border-t px-4 py-4 md:hidden"
          style={{ borderColor: "var(--ft-border)", background: "color-mix(in srgb, var(--ft-bg) 94%, transparent)" }}
        >
          <div className="flex flex-col gap-4">
            {data.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.body} py-1 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ft-text)] transition-colors hover:text-[var(--ft-primary)]`}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center gap-2 border-t pt-4 text-[var(--ft-primary)]" style={{ borderColor: "var(--ft-border)" }}>
              <MapPin className="h-4 w-4" />
              <span className={`${styles.body} text-sm font-medium`}>{data.locationLabel}</span>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
