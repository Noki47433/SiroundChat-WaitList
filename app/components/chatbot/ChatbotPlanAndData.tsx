"use client";
// Summary: Core flow that lets users pick a plan, customize the chatbot, upload knowledge/docs, and generate an embed snippet.

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { ChatbotBuilderLayout } from "./ChatbotBuilderLayout";
import type { ChatbotConfig } from "./chatbotTypes";
import { isAuthDisabledClient } from "@/lib/config/public";
import { CopyButton } from "@/components/ui/copy-button";

type PlanId = "free" | "pro" | "enterprise";

type Step = "plan" | "customize" | "knowledge" | "done";


type ChatbotPlanAndDataProps = {
  businessId?: string | null;
  businessName?: string | null;
  widgetKey?: string | null;
  isLoggedIn?: boolean;
};

const plans: { id: PlanId; name: string; price: string; features: string[] }[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    features: [
      "FAQ setup only (no other customizations)",
  "Preview-only builder, no embed or snippet export",
  "Limited grounding; upgrade for full knowledge base"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19/mo",
    features: [
      "1 chatbot with full customization",
      "Custom theme + logo, full RAG grounding",
      "Lead capture + webhooks, custom domain"
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    features: [
      "Unlimited chatbots/sites/pages",
      "Advanced analytics + larger knowledge base",
      "Custom domains, SLAs, audits, priority support"
    ]
  }
];

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const newId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }
};

export function ChatbotPlanAndData({ businessId, businessName, widgetKey, isLoggedIn }: ChatbotPlanAndDataProps) {
  // Local state for pricing choice, knowledge input, upload status, saved snippet, and persisted site ID.
  const authDisabled = isAuthDisabledClient();
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [step, setStep] = useState<Step>("customize");
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const [knowledge, setKnowledge] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: ""
  });
  const [uploadState, setUploadState] = useState<{ type: "idle" | "working" | "success" | "error"; message: string }>({
    type: "idle",
    message: ""
  });
  const [siteId, setSiteId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const existing = window.localStorage.getItem("promptlySiteId");
      if (existing && uuidRegex.test(existing)) return existing;
      const fresh = newId();
      window.localStorage.setItem("promptlySiteId", fresh);
      return fresh;
    }
    return newId();
  });
  const [builderConfig, setBuilderConfig] = useState<ChatbotConfig | null>(null);
  const [publishStatus, setPublishStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [publishMessage, setPublishMessage] = useState<string>("");
  const [snippet, setSnippet] = useState<string>("");
  const showWidgetKey = Boolean(isLoggedIn && widgetKey);

  // Keep site ID stable between reloads so ingest/uploads map to the same demo site.
  useEffect(() => {
    if (typeof window === "undefined" || !siteId) return;
    window.localStorage.setItem("promptlySiteId", siteId);
  }, [siteId]);

  const resolvedSiteId = useMemo(() => siteId ?? newId(), [siteId]);
  const uploadDisabled = !businessId || !isLoggedIn || uploadState.type === "working";

  const parseJsonResponse = async (res: Response) => {
    const raw = await res.text();
    if (!raw) {
      throw new Error("Unexpected response: (empty)");
    }
    try {
      return { data: JSON.parse(raw) as any, raw };
    } catch {
      throw new Error(`Unexpected response: ${raw.slice(0, 200)}`);
    }
  };

  const ensureEmbeddingsAccess = async (onError?: (message: string) => void) => {
    if (authDisabled) return true;
    if (!isLoggedIn) {
      window.location.href = `/signup?redirect=${encodeURIComponent("/build/chatbot#chatbot-builder")}`;
      return false;
    }
    return true;
  };

  // Sends pasted business text to the ingest API; surfaces status to guide the user.
  const ingest = async () => {
    if (!knowledge.trim()) {
      setStatus({ type: "error", message: "Add some business info first." });
      return;
    }

    const allowed = await ensureEmbeddingsAccess((message) => setStatus({ type: "error", message }));
    if (!allowed) return;

    setStatus({ type: "idle", message: "Saving..." });
    try {
      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: knowledge,
          source: "landing-demo",
          siteId: resolvedSiteId
        })
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data?.error || "Failed");
      }
      setStatus({ type: "success", message: `Stored ${data.inserted ?? "your"} snippets for grounding.` });
      setKnowledge("");
    } catch (error) {
      console.error("Ingest failed", error);
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not store data right now. Try again."
      });
    }
  };

  // Handles file uploads to the documents API, including auth/business checks.
  const uploadDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !files.length) return;

    const allowed = await ensureEmbeddingsAccess((message) => setUploadState({ type: "error", message }));
    if (!allowed) {
      event.target.value = "";
      return;
    }

    if (!businessId || !isLoggedIn) {
      setUploadState({ type: "error", message: "Log in and select a business to upload documents." });
      event.target.value = "";
      return;
    }

    setUploadState({ type: "working", message: "Uploading and processing your files..." });
    const formData = new FormData();
    formData.append("businessId", businessId);
    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }
      setUploadState({
        type: "success",
        message: `Uploaded ${data.documents?.length ?? files.length} file(s). Extracting → chunking → embeddings now.`
      });
    } catch (error) {
      setUploadState({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not upload right now. Try again or use the dashboard uploader."
      });
    }
    event.target.value = "";
  };

  // Persists widget config and produces the embed snippet; errors and success are shown inline.
  const saveConfig = async () => {
    if (!builderConfig) {
      setPublishStatus("error");
      setPublishMessage("Finish the customizer first.");
      return;
    }

    let activeSiteId = resolvedSiteId;
    if (!widgetKey && resolvedSiteId === "demo-site" && typeof crypto !== "undefined") {
      activeSiteId = crypto.randomUUID();
      setSiteId(activeSiteId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("promptlySiteId", activeSiteId);
      }
    }
    const activeKey = widgetKey ?? activeSiteId;

    setPublishStatus("saving");
    setPublishMessage("Saving widget settings...");
    try {
      // Persist full widget settings so the embed matches the builder preview.
      const payload = {
        siteId: activeKey,
        key: widgetKey ?? undefined,
        businessName: builderConfig.businessName,
        greeting: builderConfig.greeting,
        theme: {
          primary: builderConfig.theme.primaryColor,
          accent: builderConfig.theme.accentColor,
          secondary: builderConfig.theme.accentColor,
          background: builderConfig.theme.backgroundColor,
          text: builderConfig.theme.textColor,
          shape:
            builderConfig.launcherShape === "pill"
              ? "pill"
              : builderConfig.launcherShape === "square"
                ? "square"
                : "rounded"
        },
        businessType: builderConfig.businessType, // Persist business type for embed preview parity
        faqs: builderConfig.faqs, // Persist FAQ list so embed answers match builder
        launcherVariant: builderConfig.launcherVariant,
        logoUrl: builderConfig.logoUrl,
        iconId: builderConfig.iconId
      };

      const configEndpoint = widgetKey ? `/api/widget/config?key=${widgetKey}` : "/api/widget/config";
      const res = await fetch(configEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const { data } = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save widget");
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const embedSnippet = `<script src="${origin}/api/widget/loader?key=${activeKey}" async></script>`;

      setSnippet(embedSnippet);
      setPublishStatus("success");
      setPublishMessage("Saved. Copy the snippet below and paste it before </head> on any site.");
    } catch (error) {
      console.error(error);
      setPublishStatus("error");
      setPublishMessage(error instanceof Error ? error.message : "Could not save the widget right now. Try again.");
    }
  };

  const handleSnippetAction = async () => {
    if (!authDisabled && !isLoggedIn) {
      window.location.href = `/signup?redirect=${encodeURIComponent("/build/chatbot#chatbot-builder")}`;
      return;
    }
    await saveConfig();
  };

    return (
    <section className="relative overflow-hidden px-4 py-14 sm:px-8 lg:px-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-16 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-10">
        {/* STEP 1: CUSTOMIZE (free preview) */}
  {step === "customize" && (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_22px_70px_rgba(0,0,0,0.3)] backdrop-blur">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-200/80">Step 1</p>
        <h2 className="text-2xl font-semibold text-white">Customize your chatbot</h2>
        <p className="text-slate-200/80">Change the look and greeting. Preview updates live.</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/20 backdrop-blur p-6">
    <ChatbotBuilderLayout
      onConfigChange={setBuilderConfig}
      businessId={businessId}
      siteId={widgetKey ?? resolvedSiteId}
    />
  </div>


      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setStep("plan")}
          className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-400/30"
        >
          Continue to plans
        </button>
      </div>
    </div>
  )}

  {/* STEP 2: PLAN (upgraded) */}
{step === "plan" && (
  <div className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur">
    {/* Title like image 2 */}
    <div className="text-center space-y-3">
      <p className="text-sm uppercase tracking-[0.2em] text-emerald-200/80">Step 2</p>

      <h2 className="text-4xl font-semibold text-white">
        Choose your plan
      </h2>

      <p className="text-slate-200/80">
        Every tier includes the chatbot widget, website embed snippet, and builder integration.
      </p>
    </div>

    {/* Cards */}
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan) => {
        const isActive = selectedPlan === plan.id;
        const isFeatured = plan.id === "pro"; // middle glow like the screenshot

        return (
          <motion.button
            key={plan.id}
            type="button"
            onClick={() => setSelectedPlan(plan.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.99 }}
            className={[
              "relative rounded-3xl border p-6 text-left transition",
              "bg-white/5 backdrop-blur shadow-[0_20px_80px_rgba(0,0,0,0.35)]",
              isFeatured ? "border-cyan-400/40" : "border-white/10",
              isActive ? "ring-2 ring-emerald-300/60" : "ring-0"
            ].join(" ")}
          >
            {/* glow layer */}
            <div
              className={[
                "pointer-events-none absolute inset-0 rounded-3xl opacity-70",
                isFeatured
                  ? "bg-gradient-to-b from-cyan-500/20 via-indigo-500/10 to-purple-500/20"
                  : "bg-gradient-to-b from-white/5 to-transparent"
              ].join(" ")}
            />

            <div className="relative space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                  <div className="mt-1 text-3xl font-semibold text-white">{plan.price}</div>
                </div>

                {plan.id === "pro" ? (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-white/80">
                    MOST POPULAR
                  </span>
                ) : null}
              </div>

              <ul className="space-y-2 text-sm text-slate-200/85">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA button look */}
              <div className="pt-2">
                <div className="w-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 px-5 py-3 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20">
                  Get started
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>

    {/* Bottom buttons */}
    <div className="flex items-center justify-between pt-2">
      <button
        type="button"
        onClick={() => setStep("customize")}
        className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white/90 hover:bg-white/5"
      >
        Back
      </button>

      <button
        type="button"
        disabled={!selectedPlan}
        onClick={() => setStep("knowledge")}
        className="rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-400/30 disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  </div>
)}

  {/* STEP 3: KNOWLEDGE + EMBED */}
{step === "knowledge" && (
  <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_22px_70px_rgba(0,0,0,0.3)] backdrop-blur">
    <div className="space-y-2">
      <p className="text-sm uppercase tracking-[0.2em] text-emerald-200/80">Step 3</p>
      <h2 className="text-2xl font-semibold text-white">Add your business data</h2>
      <p className="text-slate-200/80">
        Paste quick info + upload files so the chatbot answers based on YOUR business.
      </p>
    </div>

    {/* Quick paste */}
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-sm font-semibold text-white">Quick paste</p>
      <p className="mt-1 text-xs text-slate-300">
        Hours, pricing, rules, FAQs, policies, services—anything important.
      </p>

      <textarea
        value={knowledge}
        onChange={(e) => setKnowledge(e.target.value)}
        placeholder="Example: We are open Mon–Sat 09:00–19:00. Refund policy is..."
        className="mt-3 min-h-[120px] w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={ingest}
          className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-400/30"
        >
          Save pasted data
        </button>

        {status.type !== "idle" ? (
          <span className={`text-sm ${status.type === "success" ? "text-emerald-200" : "text-rose-200"}`}>
            {status.message}
          </span>
        ) : null}
      </div>
    </div>

    {/* Upload files */}
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Upload documents</p>
          <p className="text-xs text-slate-300">PDF, DOCX, TXT, MD, CSV.</p>
        </div>

        <label
          className={`inline-flex min-w-[160px] cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition ${
            uploadDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-white/5"
          }`}
        >
          {uploadState.type === "working" ? "Uploading..." : "Upload files"}
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv"
            multiple
            className="hidden"
            onChange={uploadDocuments}
            disabled={uploadDisabled}
          />
        </label>
      </div>

      {uploadState.message ? (
        <p
          className={`mt-2 text-sm ${
            uploadState.type === "success"
              ? "text-emerald-200"
              : uploadState.type === "error"
                ? "text-rose-200"
                : "text-slate-200/80"
          }`}
        >
          {uploadState.message}
        </p>
      ) : null}
    </div>

    {/* Generate snippet */}
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Embed snippet</p>
          <p className="text-xs text-slate-300">Save your widget settings and get the script tag.</p>
        </div>

        <button
          type="button"
          onClick={handleSnippetAction}
          className="rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-400/30"
        >
          Save & generate snippet
        </button>
      </div>

      {showWidgetKey ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-white/10 bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Your widget key</p>
            <p className="mt-1 text-sm font-mono text-cyan-100">{widgetKey}</p>
          </div>
          <CopyButton value={widgetKey ?? ""} label="Copy key" copiedLabel="Copied" size="sm" variant="secondary" />
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3 text-xs font-mono text-cyan-100">
        {snippet ? (
          <pre className="whitespace-pre-wrap break-all">{snippet}</pre>
        ) : (
          <p className="text-slate-200/80">
            Your embed code will appear here after saving.
          </p>
        )}
        
      </div>

      {snippet ? (
        <div className="mt-3 flex justify-end">
          <CopyButton value={snippet} label="Copy snippet" copiedLabel="Copied" size="sm" variant="secondary" />
        </div>
      ) : null}

      {publishMessage ? (
        <p
          className={`mt-2 text-sm ${
            publishStatus === "success"
              ? "text-emerald-200"
              : publishStatus === "error"
                ? "text-rose-200"
                : "text-slate-200/80"
          }`}
        >
          {publishMessage}
        </p>
      ) : null}
    </div>

    {/* Nav */}
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => setStep("plan")}
        className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white/90 hover:bg-white/5"
      >
        Back
      </button>

      <button
        type="button"
        onClick={() => setStep("done")}
        className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-400/30"
      >
        Finish
      </button>
    </div>
  </div>
)}

  {/* STEP 4: DONE / CELEBRATE */}
{step === "done" && (
  <div className="space-y-4 rounded-3xl border border-emerald-300/30 bg-gradient-to-br from-emerald-900/60 via-slate-950/80 to-emerald-950/70 p-8 text-white shadow-[0_22px_70px_rgba(16,185,129,0.25)] backdrop-blur">
    <div className="space-y-2">
      <p className="text-sm uppercase tracking-[0.2em] text-emerald-200/80">All set</p>
      <h2 className="text-3xl font-semibold">Congratulations — your first chatbot is live.</h2>
      <p className="text-sm text-emerald-50/90">
        In retail alone, spending through chatbots was forecast at $12B in 2023 and projected to reach $72B by 2028 — because bots help turn questions into purchases faster.
      </p>
      <p className="text-sm text-emerald-50/90">Now you’re set up to reply instantly, capture leads, and handle FAQs 24/7.</p>
    </div>

    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => setStep("customize")}
        className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white hover:bg-white/5"
      >
        Customize again
      </button>
      <button
        type="button"
        onClick={() => setStep("plan")}
        className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-400/30"
      >
        View plans
      </button>
    </div>
  </div>
)}

        
      </div>
    </section>
  );
  }
