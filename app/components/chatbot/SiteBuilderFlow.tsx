'use client';
// Summary: Secondary section outlining the step-by-step site/chatbot builder flow; mostly static content.

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Brush, Layout, Rocket, Share2 } from "lucide-react";
import { useState } from "react";

const steps = [
  {
    title: "Gather inputs",
    body: "Name, logo, brand colors, industry, and a short blurb. Auto-extract a palette from the logo if you skip colors.",
    icon: Brush
  },
  {
    title: "AI drafts site",
    body: "GPT-4o generates hero/about/menus/testimonials/contact copy and a suggested layout per industry.",
    icon: Layout
  },
  {
    title: "Preview + edit",
    body: "Tweak taglines, swap images, or regenerate sections. Keep edits tiered for paid plans.",
    icon: Share2
  },
  {
    title: "Publish & host",
    body: "Export static HTML/CSS, serve from SiroundChat subdomains, add custom domains later with SSL automation.",
    icon: Rocket
  }
];

export function SiteBuilderFlow() {
  const router = useRouter();
  const [palette, setPalette] = useState("#00A3FF");

  const handleBuilderRoute = () => {
    router.push("/build/chatbot");
  };

  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-8 lg:px-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-10 top-8 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute left-0 bottom-0 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10">
        <div className="space-y-3 text-white">
          <p className="text-sm uppercase tracking-[0.2em] text-fuchsia-200/80">AI Website Builder</p>
          <h2 className="text-3xl font-semibold md:text-4xl">From brand inputs to a hosted site—fast.</h2>
          <p className="text-slate-200/80">
            SiroundChat doesn’t stop at chat. Feed your brand and industry, we generate the site structure, copy, and palette,
            let you preview/edit, then publish to a SiroundChat subdomain with the chatbot pre-embedded.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBuilderRoute}
              className="rounded-full bg-gradient-to-r from-fuchsia-400 to-indigo-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-fuchsia-400/25 transition hover:scale-[1.02]"
            >
              Try AI site builder
            </button>
            <button
              onClick={handleBuilderRoute}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-fuchsia-200/50"
            >
              View generated sites
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: idx * 0.05 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-400/80 to-indigo-500/80 text-slate-950 shadow-lg shadow-fuchsia-400/25">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm text-slate-200/80">{step.body}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.3)] backdrop-blur">
            <h3 className="text-xl font-semibold text-white">Sample input form</h3>
            <p className="text-sm text-slate-200/80">Collect exactly what the AI needs to draft a tailored site.</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-900">
              <input
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400"
                placeholder="Business name"
                defaultValue="Aurora Real Estate"
              />
              <input
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400"
                placeholder="Industry"
                defaultValue="Real Estate"
              />
              <textarea
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400"
                rows={3}
                placeholder="Short description"
                defaultValue="Serving Pristina since 2005. Premium listings, tailored tours, and bilingual agents."
              />
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-slate-200/80">
                  Primary color
                  <input
                    type="color"
                    value={palette}
                    onChange={(e) => setPalette(e.target.value)}
                    className="h-9 w-12 rounded-lg border border-white/10 bg-black/40"
                  />
                </label>
                <input
                  className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400"
                  placeholder="Logo URL (optional)"
                  defaultValue="https://yourcdn.com/logo.png"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleBuilderRoute}
                className="rounded-full bg-gradient-to-r from-fuchsia-400 to-indigo-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-fuchsia-400/25 transition hover:scale-[1.01]"
              >
                Generate site with AI
              </button>
              <button
                onClick={handleBuilderRoute}
                className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:border-fuchsia-200/50"
              >
                Open editor
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 text-sm text-slate-200 shadow-inner shadow-fuchsia-400/10">
            <h3 className="text-lg font-semibold text-white">Publishing & hosting</h3>
            <p className="mt-2 text-slate-200/80">
              Export static HTML/CSS/JS. Serve via SiroundChat subdomains (e.g., client.siroundchat.site) or let users connect custom
              domains later. Automate SSL with Let&apos;s Encrypt. Store generated files in object storage + CDN.
            </p>
            <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/40 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-200">Embed chatbot by default</p>
              <code className="text-[11px] text-cyan-100">
                {`<script src="/api/widget/loader?key=WIDGET_KEY" async></script>`}
              </code>
              <p className="text-slate-200/80">
                Every generated site includes the SiroundChat widget so customers get instant answers on launch day.
              </p>
            </div>
            <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/40 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-200">Template strategy</p>
              <p className="text-slate-200/80">
                Start with vetted templates per industry (hero/about/services/cta). Swap text/images from AI output; keep the design system
                consistent. For advanced tiers, allow AI-generated HTML with review/sanitization before publish.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
