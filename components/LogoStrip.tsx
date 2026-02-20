'use client';

import { motion } from "framer-motion";

const logos = [
  { name: "NovaCRM", tagline: "Customer revenue" },
  { name: "OrbitCloud", tagline: "Cloud ops" },
  { name: "Northwind", tagline: "B2B commerce" },
  { name: "Aurora Labs", tagline: "AI R&D" },
  { name: "Lanecast", tagline: "Support OS" }
];

export function LogoStrip() {
  return (
    <section className="py-14">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-r from-white/80 via-brand-soft/40 to-accent-blue/10 px-6 py-10 text-center shadow-soft sm:px-10 lg:px-14">
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/30 blur-2xl"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 12, repeat: Infinity }}
        />
        <div className="relative space-y-6">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-dark"
          >
            Trusted by fast-growing teams everywhere
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="flex flex-wrap items-center justify-center gap-8 text-lg font-semibold text-muted"
          >
            {logos.map((logo) => (
              <motion.span
                key={logo.name}
                whileHover={{ scale: 1.05, y: -2 }}
                className="group flex items-center gap-2 rounded-2xl bg-white/60 px-4 py-2 text-muted shadow-sm transition hover:text-brand"
              >
                <span className="h-2 w-2 rounded-full bg-muted/40 transition group-hover:bg-brand" />
                <span className="font-semibold tracking-tight">{logo.name}</span>
              </motion.span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
