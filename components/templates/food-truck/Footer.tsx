import Link from "next/link";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import styles from "@/components/templates/food-truck/food-truck.module.css";
import type { FoodTruckLink } from "@/components/templates/food-truck/data";

interface FooterProps {
  brand: {
    name: string;
    tagline: string;
  };
  data: {
    description: string;
    links: FoodTruckLink[];
    contactLabel: string;
    address: string;
    copyright: string;
  };
}

export function Footer({ brand, data }: FooterProps) {
  return (
    <footer className="border-t bg-[var(--ft-bg)] py-12" style={{ borderColor: "var(--ft-border)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-8 md:grid-cols-3">
          <div>
            <div className="mb-4">
              <h3 className={`${styles.display} text-lg font-bold uppercase tracking-[0.18em] text-[var(--ft-primary)]`}>
                {brand.name}
              </h3>
              <p className={`${styles.body} text-xs uppercase tracking-[0.28em] text-[var(--ft-muted)]`}>{brand.tagline}</p>
            </div>
            <p className={`${styles.body} mb-3 text-sm text-[var(--ft-muted)]`}>{data.description}</p>
            <p className={`${styles.body} text-xs font-medium uppercase tracking-[0.18em] text-[var(--ft-text)]`}>
              Casual restaurant service • dine-in • takeout • group meals
            </p>
          </div>

          <div>
            <h4 className={`${styles.display} mb-4 text-sm font-bold uppercase tracking-[0.2em] text-[var(--ft-text)]`}>
              Quick links
            </h4>
            <nav className="space-y-2">
              {data.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${styles.body} block text-sm text-[var(--ft-muted)] transition-colors hover:text-[var(--ft-primary)]`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h4 className={`${styles.display} mb-4 text-sm font-bold uppercase tracking-[0.2em] text-[var(--ft-text)]`}>
              {data.contactLabel}
            </h4>
            <div className={`${styles.body} space-y-3 text-sm text-[var(--ft-muted)]`}>
              <a href="tel:+15550132044" className="flex items-center gap-2 transition-colors hover:text-[var(--ft-primary)]">
                <Phone className="h-4 w-4" />
                (555) 013-2044
              </a>
              <a
                href="mailto:hello@northsidegrill.com"
                className="flex items-center gap-2 transition-colors hover:text-[var(--ft-primary)]"
              >
                <Mail className="h-4 w-4" />
                hello@northsidegrill.com
              </a>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {data.address}
              </p>
              <a
                href="https://instagram.com/northsidegrill"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 transition-colors hover:text-[var(--ft-primary)]"
              >
                <Instagram className="h-4 w-4" />
                @northsidegrill
              </a>
            </div>
          </div>
        </div>

        <div className="border-t pt-8" style={{ borderColor: "var(--ft-border)" }}>
          <p className={`${styles.body} text-center text-sm text-[var(--ft-muted)]`}>{data.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
