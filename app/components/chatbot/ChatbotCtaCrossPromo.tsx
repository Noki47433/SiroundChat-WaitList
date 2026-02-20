'use client';
// Summary: Secondary CTA card that nudges users toward chatbot builder; only need surface understanding.

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export function ChatbotCtaCrossPromo() {
  const router = useRouter();
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-r from-sky-900 via-indigo-900 to-fuchsia-900 px-4 py-24 sm:px-8 lg:px-16 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-6 top-0 h-80 w-80 rounded-full bg-sky-500/30 blur-3xl" />
        <div className="absolute right-10 bottom-4 h-80 w-80 rounded-full bg-fuchsia-500/25 blur-3xl" />
      </div>
      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-[34px] border border-white/20 bg-white/10 p-12 shadow-[0_30px_120px_rgba(15,23,42,0.55)] backdrop-blur">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-200">Cross promo</p>
          <h2 className="text-3xl font-semibold md:text-4xl">No website? No problem.</h2>
          <p className="max-w-3xl text-lg text-slate-100">
            Use our website builder to launch a professional site in minutes, then plug your chatbot into it. Custom colors,
            sections, and copy are all included.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push("/builder/onboarding")}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          Go to Website Builder
        </motion.button>
      </div>
    </section>
  );
}
