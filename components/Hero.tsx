"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const HeroShaderGradient = dynamic(() => import("@/app/_components/HeroShaderGradient"), {
  ssr: false,
});

type HeroProps = { isLoggedIn?: boolean };

export function Hero({ isLoggedIn }: HeroProps) {
  return (
    <section id="hero" className="relative overflow-hidden py-24">
      {/* ✅ CONTENT: ABOVE background */}
      <div className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted shadow-soft">
              AI customer support | SiroundChat
            </div>

              <div className="space-y-6">
                <h1 className="text-4xl font-semibold leading-tight text-brand-dark sm:text-5xl lg:text-[3.7rem]">
                  The AI chat assistant that feels{" "}
                  <span className="bg-gradient-to-r from-yellow-400 via-brand/100 to-accent-blue bg-clip-text text-transparent"
                  style={{ textShadow: "0 2px 12px rgba(129, 129, 129, 0.04)" }}>
                  
                    truly human
                  </span>
                  .
                </h1>

                <p className="text-lg text-brand-dark lg:text-xl">
                  SiroundChat turns every visitor question into a fast, helpful answer trained on your docs,
                  tickets, and CRM — without sounding robotic.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                {isLoggedIn ? (
                  <a
                    href="/dashboard"
                    className="rounded-full bg-brand px-6 py-3 text-center text-base font-semibold text-white shadow-soft transition hover:bg-amber-600"
                  >
                    Go to dashboard
                  </a>
                ) : (
                  <>
                    <a
                      href="/signup"
                      className="rounded-full bg-brand px-6 py-3 text-center text-base font-semibold text-white shadow-soft transition hover:bg-amber-600"
                    >
                      Create account
                    </a>
                    <a
                      href="/login"
                      className="rounded-full border border-border-subtle bg-white/70 px-6 py-3 text-center text-base font-semibold text-brand-dark transition hover:border-brand hover:text-brand-dark"
                    >
                      Login
                    </a>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-dark">
                  No credit card | 5-minute install | Works with any website
                </p>
                
              </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
