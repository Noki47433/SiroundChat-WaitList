'use client';

import { motion } from "framer-motion";

export function DeveloperSection() {
  return (
    <section id="developers" className="relative rounded-[36px] border border-white/30 bg-white/80 px-6 py-16 text-ink shadow-soft sm:px-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="space-y-6"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          For developers
        </p>
        <h3 className="text-3xl font-semibold text-brand-dark sm:text-4xl">
          Ship a fully-trained support bot in an afternoon.
        </h3>
        <p className="text-base text-muted">
          SiroundChat ships SDKs, streaming APIs, and webhooks so you can control every interaction. Define reply policies in code, log every message, and plug directly into your stack.
        </p>
        <p className="text-base text-muted">
          Bring your own UI, run headless, or stream conversations server-to-server. You get typed responses, observability hooks, and instant fallbacks whenever humans need to step in.
        </p>
        <a
          href="#docs"
          className="inline-flex rounded-full border border-border-subtle px-6 py-3 text-sm font-semibold text-brand-dark transition hover:border-brand"
        >
          Read the docs
        </a>
      </motion.div>
    </section>
  );
}
