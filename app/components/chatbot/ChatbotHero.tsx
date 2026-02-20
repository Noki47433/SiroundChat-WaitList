'use client';
// Summary: Marketing hero section for chatbot landing; secondary visual component.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChatbotPreview } from "./ChatbotPreview";
import { ChatbotConfig, ThemeConfig } from "./chatbotTypes";
import { FAQ_PRESETS } from "./chatbotFaqPresets";

const HERO_THEME: ThemeConfig = {
  primaryColor: "#6366F1",
  accentColor: "#22D3EE",
  backgroundColor: "#0F172A",
  textColor: "#E5E7EB"
};

const HERO_CONFIG: ChatbotConfig = {
  businessName: "SiroundChat Demo",
  businessType: "hotel",
  greeting: "Hi there! I'm here to help with bookings, amenities, and check-in info.",
  theme: HERO_THEME,
  logoUrl: null,
  iconId: "hotel-1",
  faqs: FAQ_PRESETS.hotel
};

export function ChatbotHero() {
  const router = useRouter();

  const scrollToBuilder = () => {
    const target = document.getElementById("chatbot-builder");
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push("/build/chatbot#chatbot-builder");
    }
  };

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-20 text-white sm:px-8 lg:px-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
        <div className="space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-[3.2rem]"
          >
            Build the perfect AI chatbot for your business.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
            className="max-w-2xl text-lg text-slate-200/80"
          >
            Tailor your chatbot with custom themes, greetings, logos, or icon avatars. Load preset FAQs for restaurants,
            hotels, gyms, clinics, and more, then watch the live preview update instantly.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="flex flex-wrap gap-3"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={scrollToBuilder}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Start building
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Back to landing
            </motion.button>
          </motion.div>
          <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
              <p className="font-semibold text-white">Preset FAQs</p>
              <p className="mt-1 text-slate-200/80">Pick a business type to auto-load ready-made questions.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
              <p className="font-semibold text-white">Instant preview</p>
              <p className="mt-1 text-slate-200/80">See every change live, from colors to greeting copy.</p>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          animate={{ y: [0, -6, 0] }}
          className="relative"
        >
          <ChatbotPreview config={HERO_CONFIG} interactive={false} autoPlayDemo showChrome />
        </motion.div>
      </div>
    </section>
  );
}
