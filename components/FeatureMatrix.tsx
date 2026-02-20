'use client';

import { motion } from "framer-motion";

const guidingPrinciples = [
  {
    title: "Understands your universe",
    detail: "Docs, tickets, CRM, and call notes are ingested instantly so every reply lands with context."
  },
  {
    title: "Keeps humans in the loop",
    detail: "Smart routing, suggested drafts, and transcripts mean your team is always informed."
  },
  {
    title: "Learns with every conversation",
    detail: "SiroundChat improves based on outcomes, not keywords, so accuracy climbs week after week."
  },
  {
    title: "Secured for scale",
    detail: "SOC 2-ready controls, redaction, and approvals keep trust with security teams."
  }
];

export function FeatureMatrix() {
  return (
    <section id="features" className="relative py-24">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[80%] -translate-x-1/2 rounded-[50px] bg-gradient-to-r from-brand/30 via-white to-accent-blue/30 blur-3xl" />
      <div className="relative mx-auto max-w-5xl rounded-[36px] border border-white/40 bg-white/85 p-8 shadow-soft sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-6"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">Why SiroundChat</p>
          <h2 className="text-3xl font-semibold text-brand-dark sm:text-4xl">
            Everything your support team wishes your chatbot could do.
          </h2>
          <p className="text-base text-muted">
            SiroundChat plugs into the systems you already rely on so responses feel personal, accurate, and effortless. Here&rsquo;s the playbook we follow for every deployment.
          </p>
          <div className="space-y-5">
            {guidingPrinciples.map((item) => (
              <div key={item.title}>
                <p className="text-sm font-semibold uppercase tracking-wide text-brand">{item.title}</p>
                <p className="text-base text-ink">{item.detail}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
