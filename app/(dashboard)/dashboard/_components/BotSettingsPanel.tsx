"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  Check,
  Globe2,
  MessageSquareText,
  Paintbrush2,
  Rocket,
  UploadCloud,
  WandSparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ChatbotThemePicker } from "@/app/components/chatbot/ChatbotThemePicker";
import type { ThemeConfig } from "@/app/components/chatbot/chatbotTypes";
import {
  markChecklistTaskComplete,
  readDashboardOnboardingState
} from "@/app/(dashboard)/dashboard/_components/onboarding/state";
import { cn } from "@/lib/utils/cn";
import type { BotSettings, ToneExamples, TonePreset } from "@/lib/types";

type BotSettingsResponse = {
  businessId: string;
  widgetKey?: string | null;
  businessName: string;
  logoUrl: string | null;
  greeting: string;
  tonePreset: TonePreset;
  theme: ThemeConfig;
};

type BotSettingsForm = BotSettings & {
  theme: ThemeConfig;
};

type WizardStepId = "brand" | "visuals" | "tone" | "deploy";

type GreetingPack = {
  code: string;
  flag: string;
  label: string;
  greetings: string[];
};

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: "#00A3FF",
  accentColor: "#38BDF8",
  backgroundColor: "#0B1222",
  textColor: "#FFFFFF"
};

const STEP_ORDER: Array<{ id: WizardStepId; label: string; icon: typeof Globe2 }> = [
  { id: "brand", label: "Business", icon: Globe2 },
  { id: "visuals", label: "Theme", icon: Paintbrush2 },
  { id: "tone", label: "Tone", icon: MessageSquareText },
  { id: "deploy", label: "Deploy", icon: Rocket }
];

const toneLabels: Record<TonePreset, string> = {
  professional: "Professional",
  friendly: "Friendly",
  luxury: "Luxury",
  short_direct: "Short & Direct",
  energetic: "Energetic"
};

const toneDescriptions: Record<TonePreset, string> = {
  professional: "Best for precise answers, reservation details, and service policies.",
  friendly: "Warm and welcoming for everyday hospitality and guest chats.",
  luxury: "Premium, polished voice for high-end positioning and elevated service.",
  short_direct: "Fast, concise replies for teams that want frictionless chat handling.",
  energetic: "More upbeat, fast-paced messaging for social-first brands."
};

const GREETING_PACKS: GreetingPack[] = [
  {
    code: "XK",
    flag: "🇽🇰",
    label: "Kosovo",
    greetings: [
      "Pershendetje, mire se vini te Rikoli. Si mund t'ju ndihmoj sot?",
      "Mire se erdhet. Mund t'ju ndihmoj me rezervime, menu ose orar pune.",
      "Pershendetje. Jam asistenti virtual i biznesit tone dhe jam gati t'ju ndihmoj."
    ]
  },
  {
    code: "AL",
    flag: "🇦🇱",
    label: "Albania",
    greetings: [
      "Pershendetje dhe mire se vini. Si mund t'ju ndihmoj sot?",
      "Mire se erdhet. Mund t'ju ndihmoj me rezervime, sherbime dhe pyetje te shpejta.",
      "Pershendetje. Jam asistenti juaj virtual per cdo pyetje rreth biznesit tone."
    ]
  },
  {
    code: "MK",
    flag: "🇲🇰",
    label: "North Macedonia",
    greetings: [
      "Pershendetje dhe mire se vini. Si mund t'ju ndihmoj sot?",
      "Mire se erdhet. Jam ketu per rezervime, orar dhe informata te biznesit.",
      "Pershendetje. Me shkruani pyetjen tuaj dhe do t'ju ndihmoj menjehere."
    ]
  },
  {
    code: "IT",
    flag: "🇮🇹",
    label: "Italy",
    greetings: [
      "Ciao e benvenuto. Come posso aiutarti oggi?",
      "Benvenuto. Posso aiutarti con prenotazioni, servizi e domande rapide.",
      "Ciao. Sono l'assistente virtuale del nostro business e sono qui per aiutarti."
    ]
  },
  {
    code: "DE",
    flag: "🇩🇪",
    label: "Germany",
    greetings: [
      "Hallo und willkommen. Wie kann ich Ihnen heute helfen?",
      "Willkommen. Ich kann bei Buchungen, Services und schnellen Fragen helfen.",
      "Hallo. Ich bin der digitale Assistent unseres Unternehmens und helfe Ihnen gern weiter."
    ]
  },
  {
    code: "GB",
    flag: "🇬🇧",
    label: "United Kingdom",
    greetings: [
      "Welcome in. I can help with bookings, pricing, and quick questions.",
      "Hi there. Need help with an appointment, service, or opening hours?",
      "Hello and welcome. I am here to guide visitors to the right next step quickly."
    ]
  },
  {
    code: "US",
    flag: "🇺🇸",
    label: "United States",
    greetings: [
      "Hi there. I can help with bookings, pricing, and quick questions.",
      "Welcome in. Need help with an appointment, service, or business info?",
      "Hello. I am the virtual assistant for this business and I am ready to help."
    ]
  },
  {
    code: "FR",
    flag: "🇫🇷",
    label: "France",
    greetings: [
      "Bonjour et bienvenue. Comment puis-je vous aider aujourd'hui ?",
      "Bienvenue. Je peux vous aider pour les reservations, les services et les questions rapides.",
      "Bonjour. Je suis l'assistant virtuel de notre entreprise et je suis la pour vous aider."
    ]
  }
];

const DEPLOYED_KEY_PREFIX = "siround_bot_settings_deployed";

const deployStorageKey = (businessId: string) => `${DEPLOYED_KEY_PREFIX}:${businessId}`;

const readDeployState = (businessId: string | null) => {
  if (!businessId || typeof window === "undefined") return false;
  return window.localStorage.getItem(deployStorageKey(businessId)) === "1";
};

const writeDeployState = (businessId: string | null, deployed: boolean) => {
  if (!businessId || typeof window === "undefined") return;
  if (deployed) {
    window.localStorage.setItem(deployStorageKey(businessId), "1");
    return;
  }
  window.localStorage.removeItem(deployStorageKey(businessId));
};

const inferInitialCountry = () => {
  if (typeof navigator === "undefined") return "XK";
  const locale = navigator.language.toUpperCase();
  const match = GREETING_PACKS.find((pack) => locale.includes(pack.code));
  return match?.code ?? "XK";
};

export function BotSettingsPanel({
  settings,
  examples
}: {
  settings: BotSettings;
  examples: ToneExamples;
}) {
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveBotSettingsRef = useRef<((options?: { silent?: boolean }) => Promise<BotSettingsResponse | null>) | null>(null);
  const initialFormState: BotSettingsForm = {
    businessName: settings.businessName,
    greeting: settings.greeting,
    tone: settings.tone,
    logoUrl: settings.logoUrl ?? null,
    theme: DEFAULT_THEME
  };

  const [form, setForm] = useState<BotSettingsForm>(() => initialFormState);
  const [initialForm, setInitialForm] = useState<BotSettingsForm>(() => initialFormState);
  const [businessId, setBusinessId] = useState<string | null>(() => null);
  const [widgetKey, setWidgetKey] = useState<string | null>(() => null);
  const [activeStep, setActiveStep] = useState<WizardStepId>("brand");
  const [selectedCountry, setSelectedCountry] = useState<string>(() => inferInitialCountry());
  const [loading, setLoading] = useState(() => false);
  const [saving, setSaving] = useState(() => false);
  const [logoUploading, setLogoUploading] = useState(() => false);
  const [draggingLogo, setDraggingLogo] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployStage, setDeployStage] = useState(0);
  const [deployComplete, setDeployComplete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(() => null);

  useEffect(() => {
    const toForm = (data: BotSettingsResponse): BotSettingsForm => ({
      businessName: data.businessName,
      greeting: data.greeting,
      tone: data.tonePreset,
      logoUrl: data.logoUrl ?? null,
      theme: data.theme ?? DEFAULT_THEME
    });

    let active = true;
    setLoading(true);

    fetch("/api/bot-settings", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as BotSettingsResponse | { error?: string } | null;
        if (!res.ok) {
          throw new Error((data as { error?: string } | null)?.error ?? "Failed to load bot settings");
        }
        if (!data || typeof (data as BotSettingsResponse).businessName !== "string") {
          throw new Error("Unexpected bot settings response");
        }
        return data as BotSettingsResponse;
      })
      .then((data) => {
        if (!active) return;
        const next = toForm(data);
        setForm(next);
        setInitialForm(next);
        setBusinessId(data.businessId ?? null);
        setWidgetKey(data.widgetKey ?? null);
        const alreadyDeployed = readDeployState(data.businessId ?? null) || readDashboardOnboardingState().completed.create_chatbot;
        setDeployComplete(alreadyDeployed);
        setActiveStep(alreadyDeployed ? "deploy" : "brand");
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Failed to load bot settings";
        setLoadError(message);
        push({ title: "Bot settings failed to load", message, variant: "error" });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [push]);

  const activeGreetingPack = useMemo(
    () => GREETING_PACKS.find((pack) => pack.code === selectedCountry) ?? GREETING_PACKS[0],
    [selectedCountry]
  );

  const toneExamples = useMemo(() => examples[form.tone] ?? [], [examples, form.tone]);
  const previewTheme = form.theme ?? DEFAULT_THEME;
  const previewExamples = toneExamples.slice(0, 2);
  const previewGreeting = form.greeting.trim() || "Hi there. I can help with bookings and quick questions.";

  const themeDirty = (Object.keys(DEFAULT_THEME) as Array<keyof ThemeConfig>).some(
    (key) => form.theme[key] !== initialForm.theme[key]
  );

  const isDirty =
    form.businessName !== initialForm.businessName ||
    form.greeting !== initialForm.greeting ||
    form.tone !== initialForm.tone ||
    form.logoUrl !== initialForm.logoUrl ||
    themeDirty;

  const canContinueFromBrand = form.businessName.trim().length > 1 && form.greeting.trim().length > 8;
  const canContinueFromVisuals = Boolean(form.theme.primaryColor && form.theme.backgroundColor && form.theme.textColor);
  const canContinueFromTone = Boolean(form.tone);
  const canDeploy = canContinueFromBrand && canContinueFromVisuals && canContinueFromTone && Boolean(businessId);
  const widgetPreviewBase = useMemo(() => {
    const params = new URLSearchParams({
      businessName: form.businessName.trim() || "Your business",
      greeting: form.greeting.trim() || "Hi there. I can help with bookings and quick questions.",
      tone: form.tone,
      primaryColor: form.theme.primaryColor,
      accentColor: form.theme.accentColor,
      backgroundColor: form.theme.backgroundColor,
      textColor: form.theme.textColor
    });

    if (form.logoUrl && !form.logoUrl.startsWith("blob:")) {
      params.set("logoUrl", form.logoUrl);
    }

    return `/widget-preview?${params.toString()}`;
  }, [form.businessName, form.greeting, form.logoUrl, form.theme, form.tone]);
  const closedPreviewUrl = `${widgetPreviewBase}&state=closed`;
  const openPreviewUrl = `${widgetPreviewBase}&state=open`;

  const buildPayload = () => {
    const payload: Partial<Pick<BotSettingsResponse, "businessName" | "greeting" | "tonePreset" | "theme">> = {};

    if (form.businessName !== initialForm.businessName) {
      payload.businessName = form.businessName.trim();
    }
    if (form.greeting !== initialForm.greeting) {
      payload.greeting = form.greeting.trim();
    }
    if (form.tone !== initialForm.tone) {
      payload.tonePreset = form.tone;
    }
    if (themeDirty) {
      payload.theme = form.theme;
    }

    return payload;
  };

  const syncSavedState = (data: BotSettingsResponse) => {
    const next: BotSettingsForm = {
      businessName: data.businessName,
      greeting: data.greeting,
      tone: data.tonePreset,
      logoUrl: data.logoUrl ?? form.logoUrl ?? null,
      theme: data.theme ?? DEFAULT_THEME
    };
    setForm(next);
    setInitialForm(next);
    setBusinessId(data.businessId ?? businessId);
    setWidgetKey(data.widgetKey ?? widgetKey);
  };

  const saveBotSettings = async (options?: { silent?: boolean }) => {
    const payload = buildPayload();
    if (!Object.keys(payload).length) return null;

    setSaving(true);
    try {
      const res = await fetch("/api/bot-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => null)) as BotSettingsResponse | { error?: string } | null;
      if (!res.ok) {
        throw new Error((data as { error?: string } | null)?.error ?? "Failed to save bot settings");
      }
      if (!data || typeof (data as BotSettingsResponse).businessName !== "string") {
        throw new Error("Unexpected bot settings response");
      }
      syncSavedState(data as BotSettingsResponse);
      if (!options?.silent) {
        push({ title: "Bot settings saved", message: "Your chatbot profile is updated.", variant: "success" });
      }
      return data as BotSettingsResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save bot settings right now.";
      if (!options?.silent) {
        push({ title: "Save failed", message, variant: "error" });
      }
      throw error;
    } finally {
      setSaving(false);
    }
  };
  saveBotSettingsRef.current = saveBotSettings;

  useEffect(() => {
    if (!deployComplete || loading || saving || !isDirty) return;

    const timeoutId = window.setTimeout(() => {
      void saveBotSettingsRef.current?.({ silent: true });
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    deployComplete,
    form.businessName,
    form.greeting,
    form.logoUrl,
    form.theme,
    form.tone,
    isDirty,
    loading,
    saving
  ]);

  const uploadLogoFile = async (file: File) => {
    if (!businessId) {
      push({ title: "Logo upload unavailable", message: "Business not loaded yet. Try again in a moment.", variant: "error" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("businessId", businessId);

    setLogoUploading(true);
    try {
      const res = await fetch("/api/logos/upload", {
        method: "POST",
        body: formData
      });
      const data = (await res.json().catch(() => null)) as { logoUrl?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to upload logo");
      }
      if (data?.logoUrl) {
        setForm((prev) => ({ ...prev, logoUrl: data.logoUrl ?? prev.logoUrl }));
        setInitialForm((prev) => ({ ...prev, logoUrl: data.logoUrl ?? prev.logoUrl }));
        push({ title: "Logo updated", message: "Your logo is ready for deployment.", variant: "success" });
      }
    } catch (error) {
      push({
        title: "Logo upload failed",
        message: error instanceof Error ? error.message : "We could not upload that logo right now.",
        variant: "error"
      });
    } finally {
      setLogoUploading(false);
      setDraggingLogo(false);
    }
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadLogoFile(file);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingLogo(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadLogoFile(file);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const stepIndex = STEP_ORDER.findIndex((step) => step.id === activeStep);
  const goToNextStep = () => {
    if (activeStep === "brand" && !canContinueFromBrand) {
      push({ title: "Complete business setup", message: "Add business name and choose a greeting first.", variant: "error" });
      return;
    }
    if (activeStep === "visuals" && !canContinueFromVisuals) {
      push({ title: "Theme incomplete", message: "Choose a theme palette before continuing.", variant: "error" });
      return;
    }
    if (activeStep === "tone" && !canContinueFromTone) {
      push({ title: "Pick a tone", message: "Choose a tone preset for the chatbot before continuing.", variant: "error" });
      return;
    }
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setActiveStep(next.id);
  };

  const goToPreviousStep = () => {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setActiveStep(prev.id);
  };

  const handleDeploy = async () => {
    if (!canDeploy || deploying) {
      push({ title: "Chatbot not ready", message: "Complete the onboarding steps before deploying.", variant: "error" });
      return;
    }

    setDeploying(true);
    setDeployStage(1);

    try {
      await Promise.all([
        saveBotSettings({ silent: true }),
        new Promise((resolve) => setTimeout(resolve, 500))
      ]);
      setDeployStage(2);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setDeployStage(3);
      await new Promise((resolve) => setTimeout(resolve, 400));

      setDeployComplete(true);
      writeDeployState(businessId, true);
      markChecklistTaskComplete("create_chatbot", true);
      push({ title: "Chatbot deployed", message: "Your widget is ready to embed on your website.", variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not deploy chatbot right now.";
      push({ title: "Deployment failed", message, variant: "error" });
    } finally {
      setDeploying(false);
    }
  };

  if (deployComplete) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-6">
          <Card className="border-[#c9a84d33] bg-[linear-gradient(180deg,rgba(11,16,27,0.94),rgba(8,12,20,0.94))] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#e5c56f]">Chatbot deployed</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Bot settings</h3>
                <p className="mt-2 text-sm text-white/65">Update the live widget without going through deployment again.</p>
              </div>
              <Badge variant="success">Live</Badge>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Business profile</p>
              <p className="text-xs text-white/60">Update the name and logo shown to visitors.</p>
            </div>
            <label className="text-sm text-white/70">
              Business name
              <Input
                value={form.businessName}
                onChange={(event) => setForm((prev) => ({ ...prev, businessName: event.target.value }))}
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="Logo preview" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="space-y-2">
                <p className="text-xs text-white/60">Upload logo</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="text-xs text-white/70"
                  disabled={!businessId || logoUploading}
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Greeting message</p>
              <p className="text-xs text-white/60">Set the opening line for new visitors.</p>
            </div>
            <Textarea
              rows={4}
              value={form.greeting}
              onChange={(event) => setForm((prev) => ({ ...prev, greeting: event.target.value }))}
            />
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Theme</p>
              <p className="text-xs text-white/60">Match the widget colors to your brand.</p>
            </div>
            <ChatbotThemePicker
              theme={form.theme}
              onThemeChange={(theme) => setForm((prev) => ({ ...prev, theme }))}
            />
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="text-sm font-semibold">Tone presets</p>
              <p className="text-xs text-white/60">Pick how the bot should sound.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(toneLabels) as TonePreset[]).map((tone) => {
                const selected = form.tone === tone;
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, tone }))}
                    aria-pressed={selected}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      selected
                        ? "border-[#00A3FF]/70 bg-[#00A3FF]/10 shadow-[0_18px_45px_rgba(0,163,255,0.15)]"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{toneLabels[tone]}</span>
                      {selected ? <Badge variant="info">Selected</Badge> : null}
                    </div>
                    <p className="mt-2 text-xs text-white/60">{toneDescriptions[tone]}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          <div>
            <Button variant="primary" onClick={() => void saveBotSettings()} disabled={!isDirty || saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
            <p className="mt-2 text-xs text-white/60">Live widget changes save automatically a moment after you edit them.</p>
            {loading ? <p className="mt-2 text-xs text-white/60">Loading settings...</p> : null}
            {loadError ? <p className="mt-2 text-xs text-rose-200">{loadError}</p> : null}
          </div>
        </div>

        <Card className="space-y-4 border-white/10 bg-neutral-950/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Live tone preview</p>
              <p className="text-xs text-white/60">A realistic chat experience with your tone.</p>
            </div>
            <Badge variant="info">{toneLabels[form.tone]}</Badge>
          </div>
          <div
            className="rounded-3xl border border-white/10 p-5"
            style={{ backgroundColor: previewTheme.backgroundColor, color: previewTheme.textColor }}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold" style={{ color: previewTheme.textColor }}>
                  {form.businessName}
                </p>
                <p className="text-xs" style={{ color: previewTheme.textColor, opacity: 0.6 }}>
                  SiroundChat assistant
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] uppercase text-emerald-200">
                Online
              </span>
            </div>
            <div className="mt-5 space-y-5">
              <div className="flex">
                <div
                  className="max-w-[80%] rounded-2xl bg-white/10 px-4 py-3 text-sm shadow"
                  style={{ color: previewTheme.textColor }}
                >
                  {previewGreeting}
                </div>
              </div>
              {previewExamples.map((example) => (
                <div key={example.question} className="space-y-3">
                  <div className="flex justify-end">
                    <div
                      className="max-w-[80%] rounded-2xl px-4 py-3 text-sm text-white shadow"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${previewTheme.primaryColor}, ${previewTheme.accentColor})`
                      }}
                    >
                      {example.question}
                    </div>
                  </div>
                  <div className="flex">
                    <div
                      className="max-w-[80%] rounded-2xl bg-white/10 px-4 py-3 text-sm shadow"
                      style={{ color: previewTheme.textColor }}
                    >
                      {example.answer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
      <div className="space-y-6">
        <Card className="border-[#c9a84d33] bg-[linear-gradient(180deg,rgba(11,16,27,0.94),rgba(8,12,20,0.94))] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-[#e5c56f]">Chatbot onboarding</p>
              <h3 className="text-3xl font-semibold text-white">Launch your chatbot in 4 steps</h3>
              <p className="max-w-2xl text-sm text-white/65">
                Set the greeting, brand visuals, tone, and deploy the widget for this business.
              </p>
            </div>
            <Badge variant={deployComplete ? "success" : "warning"}>{deployComplete ? "Deployed" : "Not deployed"}</Badge>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {STEP_ORDER.map((step, index) => {
              const Icon = step.icon;
              const active = activeStep === step.id;
              const complete = deployComplete ? true : index < stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={cn(
                    "rounded-[1.35rem] border px-4 py-4 text-left transition",
                    active
                      ? "border-[#f0c85d66] bg-[#f0c85d12] shadow-[0_24px_60px_rgba(240,200,93,0.12)]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-[#f4d26f]">
                      {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.24em] text-white/40">0{index + 1}</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-white">{step.label}</p>
                </button>
              );
            })}
          </div>
        </Card>

        {activeStep === "brand" ? (
          <Card className="space-y-6 border-white/10 bg-[#0b1220]/90 p-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[#e5c56f]">Step 1</p>
              <h4 className="text-2xl font-semibold text-white">Business profile and greeting</h4>
              <p className="text-sm text-white/65">Choose the name visitors will see and set the opening message for the first chat bubble.</p>
            </div>

            <label className="space-y-2 text-sm text-white/75">
              <span>Business name</span>
              <Input
                value={form.businessName}
                onChange={(event) => setForm((prev) => ({ ...prev, businessName: event.target.value }))}
                placeholder="Rikoli Restaurant"
                data-tutorial-target="bot-settings-business-name"
              />
            </label>

            <div className="space-y-3" data-tutorial-target="bot-settings-country">
              <div>
                <p className="text-sm font-semibold text-white">Country preset</p>
                <p className="mt-1 text-xs text-white/55">Pick the market you serve first. Each option comes with 3 starter greetings.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {GREETING_PACKS.map((pack) => {
                  const selected = pack.code === selectedCountry;
                  return (
                    <button
                      key={pack.code}
                      type="button"
                      onClick={() => setSelectedCountry(pack.code)}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition",
                        selected
                          ? "border-[#f0c85d66] bg-[#f0c85d14] text-white"
                          : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{pack.flag}</span>
                        <div>
                          <p className="text-sm font-semibold">{pack.label}</p>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">{pack.code}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3" data-tutorial-target="bot-settings-greeting">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Suggested greetings</p>
                  <p className="mt-1 text-xs text-white/55">Click one to use it directly, then edit if you want.</p>
                </div>
                <Badge variant="info">{activeGreetingPack.flag} {activeGreetingPack.label}</Badge>
              </div>
              <div className="grid gap-3">
                {activeGreetingPack.greetings.map((greeting) => {
                  const selected = form.greeting.trim() === greeting.trim();
                  return (
                    <button
                      key={greeting}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, greeting }))}
                      className={cn(
                        "rounded-2xl border px-4 py-4 text-left text-sm transition",
                        selected
                          ? "border-[#f0c85d66] bg-[#f0c85d10] text-white"
                          : "border-white/10 bg-white/[0.03] text-white/80 hover:border-white/20"
                      )}
                    >
                      {greeting}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="space-y-2 text-sm text-white/75">
              <span>Greeting message</span>
              <Textarea
                rows={4}
                value={form.greeting}
                onChange={(event) => setForm((prev) => ({ ...prev, greeting: event.target.value }))}
                placeholder="Hi there. I can help with reservations, pricing, and quick questions."
              />
            </label>
          </Card>
        ) : null}

        {activeStep === "visuals" ? (
          <Card className="space-y-6 border-white/10 bg-[#0b1220]/90 p-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[#e5c56f]">Step 2</p>
              <h4 className="text-2xl font-semibold text-white">Theme and logo</h4>
              <p className="text-sm text-white/65">Match the widget to the business brand before you deploy it.</p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-white">Logo upload</p>
                <p className="mt-1 text-xs text-white/55">Drag a logo in or browse from your computer. It uploads immediately.</p>
              </div>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDraggingLogo(true);
                }}
                onDragLeave={() => setDraggingLogo(false)}
                onDrop={handleDrop}
                className={cn(
                  "rounded-[1.6rem] border border-dashed p-5 transition",
                  draggingLogo ? "border-[#f0c85d88] bg-[#f0c85d10]" : "border-white/15 bg-white/[0.03]"
                )}
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.3rem] border border-white/10 bg-black/20">
                      {form.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.logoUrl} alt="Logo preview" className="h-full w-full object-cover" />
                      ) : (
                        <UploadCloud className="h-7 w-7 text-white/35" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{form.logoUrl ? "Logo ready" : "No logo uploaded yet"}</p>
                      <p className="mt-1 text-xs text-white/55">PNG, JPG, SVG, or WEBP work best.</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={openFilePicker} disabled={logoUploading || !businessId}>
                    {logoUploading ? "Uploading..." : "Browse logo"}
                  </Button>
                </div>
              </div>
            </div>

            <div data-tutorial-target="bot-settings-theme">
              <ChatbotThemePicker theme={form.theme} onThemeChange={(theme) => setForm((prev) => ({ ...prev, theme }))} />
            </div>
          </Card>
        ) : null}

        {activeStep === "tone" ? (
          <Card className="space-y-6 border-white/10 bg-[#0b1220]/90 p-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[#e5c56f]">Step 3</p>
              <h4 className="text-2xl font-semibold text-white">Tone preset</h4>
              <p className="text-sm text-white/65">Pick how the assistant should sound when it answers real customer questions.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2" data-tutorial-target="bot-settings-tone">
              {(Object.keys(toneLabels) as TonePreset[]).map((tone) => {
                const selected = form.tone === tone;
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, tone }))}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-[1.45rem] border px-5 py-5 text-left transition",
                      selected
                        ? "border-[#f0c85d66] bg-[#f0c85d10] shadow-[0_18px_55px_rgba(240,200,93,0.12)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-white">{toneLabels[tone]}</span>
                      {selected ? <Badge variant="success">Selected</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-white/60">{toneDescriptions[tone]}</p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <WandSparkles className="h-4 w-4 text-[#f0c85d]" />
                Sample replies in this tone
              </div>
              <div className="mt-4 space-y-3">
                {toneExamples.slice(0, 3).map((example) => (
                  <div key={example.question} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Visitor asks</p>
                    <p className="mt-2 text-sm text-white">{example.question}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-white/45">Bot reply</p>
                    <p className="mt-2 text-sm text-white/75">{example.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        {activeStep === "deploy" ? (
          <Card className="space-y-6 border-white/10 bg-[#0b1220]/90 p-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[#e5c56f]">Step 4</p>
              <h4 className="text-2xl font-semibold text-white">Deploy and embed</h4>
              <p className="text-sm text-white/65">Save the final setup, launch the widget, and copy the embed snippet for this business.</p>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={canDeploy ? "success" : "warning"}>{canDeploy ? "Ready to deploy" : "Finish previous steps"}</Badge>
                <span className="text-sm text-white/55">Widget key: {widgetKey ?? "Loading..."}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Greeting</p>
                  <p className="mt-2 text-sm text-white">{form.greeting.trim() || "Not set"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Tone</p>
                  <p className="mt-2 text-sm text-white">{toneLabels[form.tone]}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Theme</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full border border-white/10" style={{ backgroundColor: form.theme.primaryColor }} />
                    <span className="h-5 w-5 rounded-full border border-white/10" style={{ backgroundColor: form.theme.accentColor }} />
                    <span className="h-5 w-5 rounded-full border border-white/10" style={{ backgroundColor: form.theme.backgroundColor }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[#f0c85d33] bg-[linear-gradient(135deg,rgba(240,200,93,0.12),rgba(8,12,20,0.4))] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Deploy chatbot</p>
                  <p className="mt-1 text-sm text-white/65">This saves the current setup and prepares the live embed snippet.</p>
                </div>
                <Button
                  variant="primary"
                  onClick={handleDeploy}
                  disabled={!canDeploy || deploying}
                  className="min-w-[190px] bg-[#f0c85d] text-[#10131a] hover:bg-[#f4d67f]"
                  data-tutorial-target="bot-settings-deploy"
                >
                  {deploying ? "Deploying..." : deployComplete ? "Update deployment" : "Deploy chatbot"}
                </Button>
              </div>
              {deploying ? (
                <div className="mt-4 space-y-3">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#f0c85d] transition-all duration-500"
                      style={{ width: `${deployStage === 1 ? 34 : deployStage === 2 ? 68 : 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/60">
                    {deployStage === 1
                      ? "Saving business profile..."
                      : deployStage === 2
                        ? "Preparing widget configuration..."
                        : "Finalizing live embed snippet..."}
                  </p>
                </div>
              ) : null}
            </div>

          </Card>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-white/50">
            {loadError ? <span className="text-rose-200">{loadError}</span> : null}
            {loading ? <span>Loading bot settings...</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={goToPreviousStep} disabled={stepIndex === 0 || deploying}>
              Back
            </Button>
            {activeStep !== "deploy" ? (
              <Button variant="primary" onClick={goToNextStep} disabled={loading || deploying || saving}>
                Continue
              </Button>
            ) : null}
            {isDirty && activeStep !== "deploy" ? (
              <Button variant="secondary" onClick={() => void saveBotSettings()} disabled={saving || loading || deploying}>
                {saving ? "Saving..." : "Save progress"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Card className="border-white/10 bg-[radial-gradient(circle_at_top,rgba(240,200,93,0.12),rgba(7,10,16,0.96)_55%)] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#e5c56f]">Live preview</p>
              <h4 className="mt-2 text-xl font-semibold text-white">Actual widget states</h4>
            </div>
            <Badge variant="info">{toneLabels[form.tone]}</Badge>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Closed</p>
                  <p className="mt-1 text-sm text-white/75">Launcher icon exactly as it will appear on-site.</p>
                </div>
                <div className="flex h-20 w-20 items-end justify-end overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#060910]">
                  <iframe
                    title="Closed widget preview"
                    src={closedPreviewUrl}
                    className="h-[72px] w-[72px] border-0 bg-transparent pointer-events-none"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#060910] shadow-[0_35px_90px_rgba(0,0,0,0.45)]">
              <div className="border-b border-white/10 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Open</p>
                <p className="mt-1 text-sm text-white/75">Actual open widget layout using the current brand settings.</p>
              </div>
              <div className="flex items-center justify-center px-4 py-5">
                <iframe
                  title="Open widget preview"
                  src={openPreviewUrl}
                  className="h-[640px] w-[360px] border-0 bg-transparent pointer-events-none"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-white/10 bg-[#0b1220]/90 p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#f0c85d33] bg-[#f0c85d14] text-[#f0c85d]">
              <Rocket className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">What gets deployed</p>
              <div className="mt-3 space-y-3 text-sm text-white/70">
                <p>Business name and greeting shown to every visitor.</p>
                <p>Theme colors and logo pushed into the widget configuration.</p>
                <p>Tone preset ready for conversations and lead capture flows.</p>
                <p>Embed snippet tied to this business widget key.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
