"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import {
  AnalyticsVisual,
  DeveloperConsoleCard,
  FeatureGlow,
  GlobalSupportVisual,
  HeroSpotlight,
  NoWebsiteVisual,
  PricingWave,
  StartupsConstellation,
  TrainVisual,
  UseCasesOrbit
} from "./SectionVisuals";
import { ChatbotPreview } from "@/app/components/chatbot/ChatbotPreview";
import { ChatbotConfig } from "@/app/components/chatbot/chatbotTypes";
import { FAQ_PRESETS } from "@/app/components/chatbot/chatbotFaqPresets";

type Panel = {
  id: string;
  badge: string;
  title: string;
  description: string;
  content: ReactNode;
};

const chatbotDemoConfig: ChatbotConfig = {
  businessName: "Luna Bistro",
  businessType: "restaurant",
  greeting: "Hi! I'm your restaurant assistant. How can I help today?",
  theme: {
    primaryColor: "#F59E0B",
    accentColor: "#F97316",
    backgroundColor: "#FFF8E5",
    textColor: "#1F2937"
  },
  logoUrl: null,
  iconId: "restaurant-1",
  faqs: FAQ_PRESETS.restaurant
};

const panels: Panel[] = [
  {
    id: "hero",
    badge: "Realtime wow",
    title: "Conversations that glow.",
    description: "Watch SiroundChat deliver a perfectly on-brand answer in milliseconds.",
    content: <HeroSpotlight />
  },
  {
    id: "no-website",
    badge: "Launch-ready",
    title: "No website? No problem.",
    description: "Drop your logo, pick a template, and watch the AI builder assemble a site in seconds.",
    content: <NoWebsiteVisual />
  },
  {
    id: "chatbot",
    badge: "Chatbot live",
    title: "Custom AI chat for every business.",
    description: "Tailor theme, greeting, logo/icon, and FAQs with an instant preview.",
    content: (
      <div className="mx-auto max-w-sm">
        <ChatbotPreview config={chatbotDemoConfig} showChrome autoPlayDemo interactive={false} />
      </div>
    )
  },
  {
    id: "features",
    badge: "SiroundChat playbook",
    title: "Understands, loops-in, learns, secures.",
    description: "A snapshot of the four pillars behind every SiroundChat deployment.",
    content: <FeatureGlow />
  },
  {
    id: "docs",
    badge: "Training flow",
    title: "Your knowledge becomes fuel.",
    description: "Tiles float in to mirror uploading docs, connecting bases, and syncing tickets.",
    content: <TrainVisual />
  },
  {
    id: "global-support",
    badge: "Global routing",
    title: "Route every conversation smoothly.",
    description: "Visualizing multichannel queues that hand off perfectly between AI and humans.",
    content: <GlobalSupportVisual />
  },
  {
    id: "analytics",
    badge: "Insight loops",
    title: "Capture recurring value.",
    description: "Dashboards, CSAT pulses, and topic breakdowns emerge as you scroll the analytics section.",
    content: <AnalyticsVisual />
  },
  {
    id: "use-cases",
    badge: "Orbiting teams",
    title: "Every team taps the same brain.",
    description: "Support, success, sales, and product stay fully aligned.",
    content: <UseCasesOrbit />
  },
  {
    id: "developers",
    badge: "Builder mode",
    title: "Customize every reply.",
    description: "SDKs and streaming APIs give you pixel-level control.",
    content: <DeveloperConsoleCard />
  },
  {
    id: "pricing",
    badge: "Usage-based pricing",
    title: "Pay when value lands.",
    description: "Usage tiers flex with your volume - no surprise overages.",
    content: <PricingWave />
  },
  {
    id: "startups",
    badge: "Startup love",
    title: "A constellation of fast teams.",
    description: "SiroundChat scales alongside every launch milestone.",
    content: <StartupsConstellation />
  }
];

const panelMap = panels.reduce<Record<string, Panel>>((acc, panel) => {
  acc[panel.id] = panel;
  return acc;
}, {});

export function ShowcaseRail({ activeSection }: { activeSection: string }) {
  const panel = panelMap[activeSection] ?? panelMap.hero;
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute -inset-10 bg-gradient-to-b from-amber-300/30 via-transparent to-yellow-300/25 blur-3xl" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          layout
          key={panel.id}
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.985 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative min-h-[520px] overflow-hidden rounded-[46px] border border-amber-100/80 bg-gradient-to-br from-white/95 via-[#FFF8E5]/95 to-[#FFEFC8]/90 p-8 shadow-[0_50px_180px_rgba(245,158,11,0.2)] backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-14 top-14 h-40 w-40 rounded-full bg-amber-200/35 blur-3xl" />
            <div className="absolute -left-12 bottom-10 h-44 w-44 rounded-full bg-yellow-100/45 blur-3xl" />
          </div>
          <div className="mb-6 space-y-2 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">{panel.badge}</span>
            <h4 className="text-2xl font-semibold text-slate-800">{panel.title}</h4>
            <p className="text-sm text-slate-500">{panel.description}</p>
          </div>
          <div className="relative">{panel.content}</div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
