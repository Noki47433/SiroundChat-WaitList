'use client';

import { motion } from "framer-motion";

export function UseCasesCarousel() {
  return (
    <section id="use-cases" className="relative py-24">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-brand-soft/40 to-accent-blue/20 blur-3xl" />
      <div className="relative mx-auto max-w-6xl rounded-[36px] border border-white/30 bg-white/80 px-4 py-12 shadow-soft sm:px-6 lg:max-w-7xl lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-4 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">Use cases</p>
          <h3 className="text-3xl font-semibold text-brand-dark sm:text-4xl">
            Built for every team that talks to customers.
          </h3>
          <p className="text-base text-muted">
            SiroundChat adapts to support, revenue, and product workflows without forcing new playbooks.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-10 space-y-6 text-left text-base text-muted"
        >
          <p>
            <span className="font-semibold text-brand-dark">Support teams:</span> resolve questions instantly, escalate with the full context, and deflect repetitive work without losing your tone.
          </p>
          <p>
            <span className="font-semibold text-brand-dark">Sales & success:</span> qualify leads overnight, summarize health signals, and sync data directly into your CRM.
          </p>
          <p>
            <span className="font-semibold text-brand-dark">Product & ops:</span> group feedback by themes, prioritize UX fixes, and turn insights into roadmap-ready briefs.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
