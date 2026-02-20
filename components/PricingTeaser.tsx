'use client';

import { motion } from "framer-motion";

const talkingPoints = [
  "Start free with 500 automated replies included. Metered usage kicks in only when SiroundChat is actively helping your customers.",
  "Add unlimited teammates at no cost. SiroundChat is priced on customer impact, not seat count.",
  "Volume discounts apply automatically as your resolutions grow. No negotiations, no locked bundles."
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="relative py-24">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-brand-soft/50 to-accent-blue/30 blur-2xl" />
      <div className="relative mx-auto max-w-5xl rounded-[36px] border border-white/30 bg-white/80 px-6 py-12 shadow-soft sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6 text-left"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">Pricing</p>
          <h3 className="text-3xl font-semibold text-brand-dark sm:text-4xl">
            Simple, usage-based pricing.
          </h3>
          <p className="text-base text-muted">
            SiroundChat charges only when it&apos;s delivering value. That means your invoices scale with the number of real conversations we resolve, not the number of seats you provision.
          </p>
          <div className="space-y-4">
            {talkingPoints.map((point) => (
              <p key={point} className="text-base text-ink">
                {point}
              </p>
            ))}
          </div>
          <a href="#pricing" className="inline-flex text-base font-semibold text-brand">
            View full pricing &gt;
          </a>
        </motion.div>
      </div>
    </section>
  );
}
