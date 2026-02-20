// Summary: Secondary pricing/benefits section for chatbot marketing page.
'use client';

import { motion } from "framer-motion";

const plans = [
  {
    name: "Starter",
    price: "€0 / mo",
    description: "Perfect for testing and small businesses.",
    features: ["1 chatbot", "Up to 200 conversations/mo", "Basic theming", "Email support"],
    highlighted: false
  },
  {
    name: "Pro",
    price: "€29 / mo",
    description: "Most popular for growing teams.",
    features: ["3 chatbots", "5k conversations/mo", "Advanced FAQ logic", "Priority support"],
    highlighted: true,
    badge: "Most popular"
  },
  {
    name: "Business",
    price: "€79 / mo",
    description: "Everything you need at scale.",
    features: ["Unlimited chatbots", "Unlimited conversations", "Team collaboration", "Advanced analytics", "Custom onboarding"],
    highlighted: false
  }
];

export function ChatbotPricingSection() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 px-4 py-24 text-white sm:px-8 lg:px-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-0 h-80 w-80 rounded-full bg-sky-500/25 blur-3xl" />
        <div className="absolute right-10 bottom-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl space-y-10">
        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">Choose your plan</h2>
          <p className="text-lg text-slate-200">
            Every tier includes the chatbot widget, website embed snippet, and the website builder integration.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: index * 0.05 }}
              className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 shadow-[0_30px_90px_rgba(15,23,42,0.45)] transition ${
                plan.highlighted
                  ? "border-sky-400/60 bg-gradient-to-br from-sky-500/30 via-indigo-600/20 to-fuchsia-500/30"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="absolute inset-0 opacity-40 blur-3xl" />
              {plan.badge ? (
                <span className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  {plan.badge}
                </span>
              ) : null}
              <div className="relative space-y-2">
                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                <p className="text-3xl font-semibold text-white">{plan.price}</p>
                <p className="text-sm text-slate-200">{plan.description}</p>
              </div>
              <ul className="relative mt-4 space-y-2 text-sm text-slate-100">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-sky-300" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="relative mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Get started
              </motion.button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
