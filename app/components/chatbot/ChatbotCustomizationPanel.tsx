'use client';
// Summary: Core stepper that edits chatbot brand, type, logo, icon, theme, and FAQs; drives what the preview shows and what gets saved.

import { useEffect, useMemo, useState } from "react";
import { ChatbotBusinessTypeSelector } from "./ChatbotBusinessTypeSelector";
import { ChatbotFaqEditor } from "./ChatbotFaqEditor";
import { ChatbotGreetingInput } from "./ChatbotGreetingInput";
import { ChatbotIconLibrary } from "./ChatbotIconLibrary";
import { ChatbotLogoUploader } from "./ChatbotLogoUploader";
import { ChatbotThemePicker } from "./ChatbotThemePicker";
import { BusinessType, ChatbotConfig } from "./chatbotTypes";

type ChatbotCustomizationPanelProps = {
  config: ChatbotConfig;
  onConfigChange: (updates: Partial<ChatbotConfig>) => void;
  onBusinessTypeChange: (businessType: BusinessType) => void;
  mode?: "page" | "embed";
  businessId?: string | null;
  siteId?: string | null;
};

export function ChatbotCustomizationPanel({
  config,
  onConfigChange,
  onBusinessTypeChange,
  mode = "embed",
  businessId,
  siteId
}: ChatbotCustomizationPanelProps) {
  // Stepper state controls which question is visible; losing it breaks the guided flow.
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const updates: Partial<ChatbotConfig> = {};
    if (config.launcherShape !== "circle") {
      updates.launcherShape = "circle";
    }
    if (config.launcherVariant !== "iconWithLabel") {
      updates.launcherVariant = "iconWithLabel";
    }
    if (Object.keys(updates).length) {
      onConfigChange(updates);
    }
  }, [config.launcherShape, config.launcherVariant, onConfigChange]);

  // Ordered steps so the builder progresses through brand -> type -> logo -> icon -> theme -> FAQs.
  const steps = useMemo(
    () => [
      {
        id: "brand",
        title: "Brand voice",
        prompt: "How should the chatbot greet people and reference your business?",
        body: (
          <ChatbotGreetingInput
            businessName={config.businessName}
            greeting={config.greeting}
            onBusinessNameChange={(businessName) => onConfigChange({ businessName })}
            onGreetingChange={(greeting) => onConfigChange({ greeting })}
          />
        )
      },
      {
        id: "type",
        title: "Business focus",
        prompt: "Pick a preset so we can load starter FAQs for that industry.",
        body: <ChatbotBusinessTypeSelector businessType={config.businessType} onChange={onBusinessTypeChange} />
      },
      {
        id: "logo",
        title: "Logo upload",
        prompt: "Upload your logo to use for the chat bubble.",
        body: (
          <ChatbotLogoUploader
            logoUrl={config.logoUrl}
            businessId={businessId}
            siteId={siteId}
            onLogoChange={(logoUrl) => onConfigChange({ logoUrl })}
            onColorExtract={(theme) =>
              onConfigChange({
                theme: {
                  ...config.theme,
                  ...theme
                }
              })
            }
          />
        )
      },
      {
        id: "icon",
        title: "Icon library",
        prompt: "Pick an icon avatar if you don't have a logo.",
        body: <ChatbotIconLibrary selectedIconId={config.iconId} onSelectIcon={(iconId) => onConfigChange({ iconId, logoUrl: null })} />
      },
      {
        id: "theme",
        title: "Theme & vibe",
        prompt: "Pick a palette or fine-tune colors so the chat matches your brand.",
        body: <ChatbotThemePicker theme={config.theme} onThemeChange={(theme) => onConfigChange({ theme })} />
      },
      {
        id: "faqs",
        title: "FAQs",
        prompt: "Tweak the starter questions so the chatbot feels ready out of the box.",
        body: <ChatbotFaqEditor faqs={config.faqs} onChange={(faqs) => onConfigChange({ faqs })} businessType={config.businessType} />
      }
    ],
    [config, onBusinessTypeChange, onConfigChange, businessId, siteId]
  );

  const currentStep = steps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  // Navigation helpers keep the step within bounds.
  const goNext = () => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  const goBack = () => setStepIndex((prev) => Math.max(prev - 1, 0));

    return (
  <div
    className={
      mode === "page"
        ? "relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 shadow-[0_25px_80px_rgba(59,130,246,0.15)] backdrop-blur"
        : "relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-6 text-white"
    }
  >
    {mode === "page" && (
      <>
        <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-48 w-48 rounded-full bg-indigo-200/40 blur-3xl" />
      </>
    )}

    <div className="relative space-y-5">
      {mode === "page" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 1 — Customize your chatbot</p>
            <h3 className="text-2xl font-semibold text-slate-900">Guide-style builder</h3>
            <p className="text-sm text-slate-600">Answer one prompt at a time with a colorful, focused flow.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 shadow">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live preview updates on the right
          </div>
        </div>
      )}

      <div
        className={
          mode === "page"
            ? "space-y-4 rounded-2xl border border-white/60 bg-white/90 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.12)]"
            : "space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4"
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={mode === "page" ? "text-xs font-semibold uppercase tracking-wide text-slate-500" : "text-xs font-semibold uppercase tracking-wide text-slate-400"}>
              Question {stepIndex + 1} of {steps.length}
            </p>
            <h4 className={mode === "page" ? "text-lg font-semibold text-slate-900" : "text-lg font-semibold text-white"}>
              {currentStep.title}
            </h4>
            <p className={mode === "page" ? "text-sm text-slate-600" : "text-sm text-slate-300"}>{currentStep.prompt}</p>
          </div>

          {mode === "page" && (
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              Guided flow
            </div>
          )}
        </div>

        <div
          className={
            mode === "page"
              ? "rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-inner"
              : "rounded-2xl border border-white/10 bg-black/20 p-4"
          }
        >
          {currentStep.body}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            {steps.map((s, index) => {
              const isActive = index === stepIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={`h-2.5 w-8 rounded-full transition ${isActive ? "bg-sky-500" : "bg-white/15 hover:bg-white/25"}`}
                  aria-label={`Jump to ${s.title}`}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                stepIndex === 0
                  ? "cursor-not-allowed border-white/10 text-white/40"
                  : "border-white/15 bg-white/5 text-white/90 hover:bg-white/10"
              }`}
            >
              Back
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={stepIndex === steps.length - 1}
              className={`rounded-full px-5 py-2 text-sm font-semibold text-white shadow-lg transition ${
                stepIndex === steps.length - 1 ? "cursor-not-allowed bg-white/20" : "bg-gradient-to-r from-sky-500 to-indigo-500 hover:brightness-105"
              }`}
            >
              {stepIndex === steps.length - 1 ? "Done" : "Next question"}
            </button>
          </div>
        </div>
      </div>

      {mode === "page" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 transition-[width]"
              style={{ width: `${progress}%` }}
              aria-label="Builder progress"
            />
          </div>
        </div>
      )}
    </div>
  </div>
);
}
