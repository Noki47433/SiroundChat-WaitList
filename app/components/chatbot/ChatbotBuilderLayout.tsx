"use client";

import { useMemo, useState } from "react";
import { FAQ_PRESETS } from "./chatbotFaqPresets";
import type { BusinessType, ChatbotConfig, ThemeConfig } from "./chatbotTypes";
import { ChatbotCustomizationPanel } from "./ChatbotCustomizationPanel";
import { ChatbotPreview } from "./ChatbotPreview";

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: "#4F46E5",
  accentColor: "#22D3EE",
  backgroundColor: "#F8FAFC",
  textColor: "#0F172A",
};

const INITIAL_CONFIG: ChatbotConfig = {
  businessName: "Your business",
  businessType: "restaurant",
  greeting: "Hi! I'm your virtual assistant. How can I help you today?",
  theme: DEFAULT_THEME,
  logoUrl: null,
  iconId: "restaurant-1",
  faqs: FAQ_PRESETS.restaurant,
  launcherShape: "circle",
  launcherVariant: "iconWithLabel",
};

type BuilderProps = {
  onConfigChange?: (config: ChatbotConfig) => void;
  mode?: "page" | "embed";
  businessId?: string | null;
  siteId?: string | null;
};

export function ChatbotBuilderLayout({ onConfigChange, mode = "embed", businessId, siteId }: BuilderProps) {
  const [config, setConfig] = useState<ChatbotConfig>(INITIAL_CONFIG);

  const notifyParent = (next: ChatbotConfig) => {
    if (!onConfigChange) return;
    setTimeout(() => onConfigChange(next), 0);
  };

  const handleConfigChange = (updates: Partial<ChatbotConfig>) => {
  setConfig((prev) => {
    const next = { ...prev, ...updates };
    notifyParent(next);
    return next;
  });
};

  const handleBusinessTypeChange = (businessType: BusinessType) => {
  setConfig((prev) => {
    const next: ChatbotConfig = {
      ...prev,
      businessType,
      faqs: FAQ_PRESETS[businessType] ?? [],
    };
    notifyParent(next);
    return next;
  });
};

  const previewConfig = useMemo(() => config, [config]);
  const Wrapper: any = mode === "page" ? "section" : "div";

  return (
    <Wrapper
      id={mode === "page" ? "chatbot-builder" : undefined}
      className={
        mode === "page"
          ? "relative w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-16 text-white sm:px-8 lg:px-16"
          : "text-white"
      }
    >
      {mode === "page" && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
        </div>
      )}

      <div className={mode === "page" ? "relative mx-auto max-w-7xl space-y-10" : "space-y-6"}>
        {mode === "page" && (
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-white">Customize your chatbot</h2>
            <p className="text-slate-200/80">Choose your business type, greeting, theme, and FAQs.</p>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-10">
          <ChatbotCustomizationPanel
            config={config}
            onConfigChange={handleConfigChange}
            onBusinessTypeChange={handleBusinessTypeChange}
            businessId={businessId}
            siteId={siteId}
          />

          <div className="relative lg:sticky lg:top-24">
            {mode === "page" && (
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-white">Live preview</h3>
                <p className="text-sm text-slate-200/80">See your changes instantly.</p>
              </div>
            )}

            <ChatbotPreview config={previewConfig} interactive startCollapsed />
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
