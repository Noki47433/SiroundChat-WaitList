'use client';

import { motion } from "framer-motion";

const pillars = [
  {
    title: "Launch fast",
    body: "Install SiroundChat anywhere in minutes. Bring help center URLs, tickets, or CRM data and SiroundChat will reflect your institutional knowledge instantly."
  },
  {
    title: "Learn faster",
    body: "See trending topics, CSAT shifts, and revenue influence without digging through spreadsheets. SiroundChat surfaces what your execs want to know."
  },
  {
    title: "Scale effortlessly",
    body: "Loop in the right humans with role-based routing, shared context, and live presence indicators. Global teams stay aligned without another tool."
  }
];

export function StartupsSection() {
  return (
    <section className="relative py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand-soft/50 to-transparent blur-2xl" />
      <div className="relative mx-auto max-w-5xl rounded-[36px] border border-white/30 bg-white/80 px-6 py-12 shadow-soft sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6 text-left"
        >
          <h3 className="text-3xl font-semibold text-brand-dark sm:text-4xl">
            Take your support from reactive to unforgettable.
          </h3>
          <p className="text-base text-muted">
            SiroundChat gives fast-growing startups the polish of a 24/7 global team. Work through each phase of growth with confidence.
          </p>
          <div className="space-y-5">
            {pillars.map((pillar) => (
              <div key={pillar.title}>
                <p className="text-sm font-semibold uppercase tracking-wide text-brand">{pillar.title}</p>
                <p className="text-base text-ink">{pillar.body}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
