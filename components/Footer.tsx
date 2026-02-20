'use client';

import { motion } from "framer-motion";
import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "#features" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Changelog", href: "#docs" }
    ]
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Careers", href: "#careers" },
      { label: "Blog", href: "#blog" }
    ]
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#docs" },
      { label: "API reference", href: "#developers" },
      { label: "Status", href: "#status" }
    ]
  }
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mt-24 border-t border-border-subtle bg-white py-14"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:max-w-7xl lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-brand-soft text-brand-dark shadow-soft">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="6" stroke="#F59E0B" strokeWidth="2" />
                <path d="M8 15c2 1.5 6 1.5 8 0" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-brand-dark">SiroundChat</p>
              <p className="text-sm text-muted">AI answers that sound like your best teammate.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {footerColumns.map((column) => (
            <div key={column.title} className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">{column.title}</p>
              <ul className="space-y-2 text-sm text-muted">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="transition hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border-subtle pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} SiroundChat, Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="#privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="#terms" className="hover:text-ink">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
