'use client';

import { motion } from "framer-motion";
import Image from "next/image";
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
      className="mt-24 pb-10 pt-6"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:max-w-7xl lg:px-10">
        <div className="overflow-hidden rounded-[34px] border border-white/80 bg-[#F3F4F7]/95 px-6 py-8 shadow-[0_18px_46px_rgba(15,23,42,0.12)] sm:px-9 sm:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-[#ECEBDD] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_rgba(15,23,42,0.08)]">
                <Image
                  src="/images-logo/SiroundChatLogo.png"
                  alt="SiroundChat logo"
                  width={44}
                  height={32}
                  className="h-9 w-auto"
                />
              </div>
              <div>
                <p className="text-[2rem] font-semibold leading-tight tracking-tight text-brand-dark sm:text-4xl">SiroundChat</p>
                <p className="text-base text-muted sm:text-lg">AI answers that sound like your best teammate.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {footerColumns.map((column) => (
              <div key={column.title} className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand">{column.title}</p>
                <ul className="space-y-2 text-sm text-muted sm:text-[1.05rem]">
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

          <div className="mt-10 flex flex-col gap-4 border-t border-border-subtle pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:text-[1.05rem]">
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
      </div>
    </motion.footer>
  );
}
