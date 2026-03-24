'use client';
// Summary: Secondary landing section explaining the chatbot; mostly static marketing content.

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ChatbotPreview } from "./ChatbotPreview";
import { ChatbotConfig, ThemeConfig } from "./chatbotTypes";
import { FAQ_PRESETS } from "./chatbotFaqPresets";

const LANDING_THEME: ThemeConfig = {
  primaryColor: "#F59E0B",
  accentColor: "#F97316",
  backgroundColor: "#FFF8E5",
  textColor: "#1F2937"
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
    <section className="relative w-full overflow-hidden rounded-[36px] border border-white/70 bg-gradient-to-br from-white via-[#FFF9EA] to-[#FFEFC2] px-4 py-20 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.1)] md:px-8 lg:px-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-20 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-yellow-200/35 blur-3xl" />
      </div>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12">
        <div className="space-y-6 max-w-3xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 bg-clip-text text-4xl font-semibold text-transparent md:text-5xl lg:text-6xl"
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
                <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                <span>{feature}</span>
              </motion.li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleBuilderCta}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#FFF9EA]"
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
              className="rounded-full px-2 py-1 text-sm font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#FFF9EA]"
            >
              See how it works
            </button>
          </div>
        </div>

        <div className="md:hidden">
          <ChatbotPreview config={landingDemoConfig} showChrome autoPlayDemo interactive={false} />
        </div>
      </div>
    </section>
  );
}
