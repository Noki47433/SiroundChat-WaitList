'use client';

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { NoWebsiteVisual } from "./SectionVisuals";

const arrowVariants = {
  rest: { x: 10, opacity: 0 },
  hover: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 260, damping: 18 }
  }
};

export function NoWebsiteSection() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const handleCtaClick = () => {
    if (loading) return;
    if (user) {
      router.push("/builder/onboarding");
      return;
    }
    router.push("/signup?redirect=/builder/onboarding");
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/90 px-6 py-12 shadow-soft backdrop-blur-lg sm:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-12 top-6 h-48 w-48 rounded-full bg-[#F7C948]/30 blur-3xl" />
        <div className="absolute bottom-0 right-6 h-56 w-56 rounded-full bg-amber-200/60 blur-3xl" />
      </div>

      <div className="relative space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-2xl space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F7C948]/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-dark">
            <span className="h-2 w-2 rounded-full bg-[#F7C948]" />
            Launch-ready in minutes
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-semibold leading-tight text-brand-dark sm:text-5xl">
              No Website? No Problem!
            </h2>
            <p className="text-lg text-muted">
              Just drop your logo, pick your business type, and our AI will build your site in seconds.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <motion.button
              type="button"
              initial="rest"
              whileHover="hover"
              animate="rest"
              disabled={loading}
              onClick={handleCtaClick}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-yellow-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span>Get Started</span>
              <motion.span variants={arrowVariants} className="text-lg leading-none">
                &rarr;
              </motion.span>
            </motion.button>
            <p className="text-sm text-muted">No setup headaches - we publish for you.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Drop your logo",
                body: "We instantly pull your colors and typography cues."
              },
              {
                title: "Pick a template",
                body: "Tailored for restaurants, hotels, salons, stores, freelancers, and more."
              }
            ].map((item) => (
              <motion.div
                key={item.title}
                whileHover={{ y: -4 }}
                className="rounded-2xl border border-[#F7C948]/20 bg-white/70 p-4 shadow-inner"
              >
                <p className="text-sm font-semibold text-brand-dark">{item.title}</p>
                <p className="mt-1 text-sm text-muted">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.05 }}
          className="lg:hidden"
        >
          <NoWebsiteVisual />
        </motion.div>
      </div>
    </section>
  );
}
