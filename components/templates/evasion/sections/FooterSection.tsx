import Link from "next/link";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";

type FooterSectionProps = {
  brand: string;
  data: EvasionTemplateData["footer"];
};

export function FooterSection({ brand, data }: FooterSectionProps) {
  return (
    <footer className="bg-[var(--evasion-bg)]">
      <div className="border-t border-[var(--evasion-border)] px-6 py-16 md:px-12 md:py-20 lg:px-20">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 md:col-span-1 lg:col-span-2">
            <Link href="#top" className="text-lg font-medium text-[var(--evasion-text)]">
              {brand}
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--evasion-muted)]">{data.description}</p>
          </div>

          {data.columns.map((column) => (
            <div key={column.title}>
              <h4 className="mb-4 text-sm font-medium text-[var(--evasion-text)]">{column.title}</h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-[var(--evasion-muted)] transition-colors hover:text-[var(--evasion-text)]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--evasion-border)] px-6 py-6 md:px-12 lg:px-20">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-xs text-[var(--evasion-muted)]">{data.legalText}</p>
          <div className="flex items-center gap-4">
            {data.socials.map((social) => (
              <Link key={social.label} href={social.href} className="text-xs text-[var(--evasion-muted)] transition-colors hover:text-[var(--evasion-text)]">
                {social.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
