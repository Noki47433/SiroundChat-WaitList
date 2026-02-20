'use client';

import { motion } from "framer-motion";
import Link from "next/link";

type CTA = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

interface SectionSplitProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryCta?: CTA;
  secondaryCta?: CTA;
  id?: string;
}

export function SectionSplit({
  eyebrow,
  title,
  body,
  primaryCta,
  secondaryCta,
  id
}: SectionSplitProps) {
  return (
    <section id={id} className="relative py-24">
      <div className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-40 max-w-5xl rounded-[50px] bg-gradient-to-r from-brand/25 via-white to-accent-blue/25 blur-3xl" />
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] border border-white/30 bg-white/80 px-6 py-10 shadow-soft sm:px-10 lg:max-w-7xl">
        <motion.div
          aria-hidden
          initial={{ opacity: 0.3, scale: 0.9 }}
          animate={{ opacity: 0.6, scale: 1 }}
          transition={{ duration: 12, repeat: Infinity, repeatType: "reverse" }}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.8),_transparent_70%)]"
        />
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="space-y-6"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
            <h3 className="text-3xl font-semibold text-brand-dark sm:text-4xl">{title}</h3>
            <p className="text-base text-muted">{body}</p>
            <div className="flex flex-wrap gap-4">
              {primaryCta && (
                <Link
                  href={primaryCta.href}
                  className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-amber-600"
                >
                  {primaryCta.label}
                </Link>
              )}
              {secondaryCta && (
                <Link
                  href={secondaryCta.href}
                  className="rounded-full border border-border-subtle px-6 py-3 text-sm font-semibold text-ink transition hover:border-brand"
                >
                  {secondaryCta.label}
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
