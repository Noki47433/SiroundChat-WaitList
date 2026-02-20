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
    primaryColor: "#6366F1",
    accentColor: "#22D3EE",
    backgroundColor: "#0F172A",
    textColor: "#E5E7EB"
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
    <div className="relative hidden lg:block">
      <div className="sticky top-28">
        <div className="pointer-events-none absolute -inset-10 bg-gradient-to-b from-brand/20 via-transparent to-accent-blue/30 blur-3xl" />
        <AnimatePresence mode="wait">
          <motion.div
            key={panel.id}
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.97 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative overflow-hidden rounded-[40px] border border-white/30 bg-white/80 p-8 shadow-[0_50px_180px_rgba(15,23,42,0.25)] backdrop-blur-xl"
          >
            
            <div className="mb-6 space-y-2 text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">{panel.badge}</span>
              <h4 className="text-2xl font-semibold text-brand-dark">{panel.title}</h4>
              <p className="text-sm text-muted">{panel.description}</p>
            </div>
            <div>{panel.content}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
