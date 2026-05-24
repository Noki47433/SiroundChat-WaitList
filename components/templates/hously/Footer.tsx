import Link from "next/link";

import { HouslyWordmark } from "@/components/templates/hously/HouslyWordmark";
import type { HouslyTemplateData } from "@/components/templates/hously/data";

type FooterProps = {
  brand: string;
  data: HouslyTemplateData["footer"];
};

export function Footer({ brand, data }: FooterProps) {
  return (
    <footer className="border-t py-16 md:py-24" style={{ borderColor: "var(--hously-border)" }}>
      <div className="container mx-auto px-6 md:px-12">
        <div className="mb-16 grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-6">
              <HouslyWordmark brand={brand} href="#hero" />
            </div>
            <p className="max-w-sm leading-relaxed text-[var(--hously-muted)]">{data.description}</p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-medium">{data.navigationTitle}</h4>
            <ul className="space-y-3 text-sm text-[var(--hously-muted)]">
              {data.navigationItems.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="transition-colors hover:text-[var(--hously-foreground)]">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-medium">{data.contactTitle}</h4>
            <ul className="space-y-3 text-sm text-[var(--hously-muted)]">
              <li>
                <a href={`mailto:${data.email}`} className="transition-colors hover:text-[var(--hously-foreground)]">
                  {data.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${data.phone.replace(/[^\d+]/g, "")}`}
                  className="transition-colors hover:text-[var(--hously-foreground)]"
                >
                  {data.phone}
                </a>
              </li>
              {data.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="transition-colors hover:text-[var(--hously-foreground)]">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="flex flex-col gap-4 border-t pt-8 text-sm text-[var(--hously-muted)] md:flex-row md:items-center md:justify-between"
          style={{ borderColor: "var(--hously-border)" }}
        >
          <p>© 2026 {brand}. All rights reserved.</p>
          <div className="flex gap-6">
            {data.legal.map((item) => (
              <Link key={item} href="#" className="transition-colors hover:text-[var(--hously-foreground)]">
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
