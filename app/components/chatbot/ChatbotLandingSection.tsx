'use client';
// Summary: Secondary landing section explaining the chatbot; mostly static marketing content.

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ChatbotPreview } from "./ChatbotPreview";
import { ChatbotConfig, ThemeConfig } from "./chatbotTypes";
import { FAQ_PRESETS } from "./chatbotFaqPresets";

const LANDING_THEME: ThemeConfig = {
  primaryColor: "#6366F1",
  accentColor: "#22D3EE",
  backgroundColor: "#0F172A",
  textColor: "#E5E7EB"
};

const landingDemoConfig: ChatbotConfig = {
  businessName: "Luna Bistro",
  businessType: "restaurant",
  greeting: "Hi! I'm your restaurant assistant. How can I help today?",
  theme: LANDING_THEME,
  logoUrl: null,
  iconId: "restaurant-1",
  faqs: FAQ_PRESETS.restaurant
};

export function ChatbotLandingSection() {
  const router = useRouter();
  const handleBuilderCta = () => {
    router.push("/build/chatbot");
  };

  const features = [
    "Customize theme, greeting, and avatar in seconds.",
    "Restaurant, hotel, gym, and more — pre-built FAQ templates.",
    "Real-time preview of your chatbot as you build.",
    "Just paste one snippet to install it on your site."
  ];

  return (
    <section className="relative w-full bg-gradient-to-br from-white via-slate-50 to-sky-50 py-24 px-4 md:px-8 lg:px-16 text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-20 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
      </div>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12">
        <div className="space-y-6 max-w-3xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-4xl font-semibold md:text-5xl lg:text-6xl bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-500 bg-clip-text text-transparent"
          >
            No chatbot? No problem.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
            className="text-lg text-slate-700"
          >
            Add an AI-powered chat widget to your site with your own theme and greeting. Upload a logo or pick an icon,
            load pre-programmed FAQs for restaurants, hotels, gyms and more, and see every edit live before you install.
          </motion.p>
          <ul className="space-y-2 text-sm text-slate-600">
            {features.map((feature) => (
              <motion.li
                key={feature}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex items-start gap-2"
              >
                <span className="mt-1 h-2 w-2 rounded-full bg-sky-400" />
                <span>{feature}</span>
              </motion.li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleBuilderCta}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-sky-500/30 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              <span>Get started</span>
              <motion.span
                initial={{ x: 8, opacity: 0 }}
                whileHover={{ x: 0, opacity: 1 }}
                className="inline-flex"
              >
                <ArrowRight className="h-4 w-4" />
              </motion.span>
            </motion.button>
            <button
              type="button"
              onClick={handleBuilderCta}
              className="rounded-full px-2 py-1 text-sm font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-white"
            >
              See how it works
            </button>
          </div>
        </div>

        <div className="lg:hidden">
          <ChatbotPreview config={landingDemoConfig} showChrome autoPlayDemo interactive={false} />
        </div>
      </div>
    </section>
  );
}
