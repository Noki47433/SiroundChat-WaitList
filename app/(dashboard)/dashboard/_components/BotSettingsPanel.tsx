"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { BotSettings, ToneExamples, TonePreset } from "@/lib/types";
import { ChatbotThemePicker } from "@/app/components/chatbot/ChatbotThemePicker";
import type { ThemeConfig } from "@/app/components/chatbot/chatbotTypes";

type BotSettingsResponse = {
  businessId: string;
  businessName: string;
  logoUrl: string | null;
  greeting: string;
  tonePreset: TonePreset;
  theme: ThemeConfig;
};

type BotSettingsForm = BotSettings & {
  theme: ThemeConfig;
};

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: "#00A3FF",
  accentColor: "#38BDF8",
  backgroundColor: "#0B1222",
  textColor: "#FFFFFF"
};

const toneLabels: Record<TonePreset, string> = {
  professional: "Professional",
  friendly: "Friendly",
  luxury: "Luxury",
  short_direct: "Short & Direct",
  energetic: "Energetic"
};

const toneDescriptions: Record<TonePreset, string> = {
  professional: "Clear, precise, and business-ready.",
  friendly: "Warm, helpful, and approachable.",
  luxury: "Polished, premium, and confident.",
  short_direct: "Concise answers with no fluff.",
  energetic: "Upbeat, fast, and engaging."
};

export function BotSettingsPanel({
  settings,
  examples
}: {
  settings: BotSettings;
  examples: ToneExamples;
}) {
  const { push } = useToast();
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
  const [loading, setLoading] = useState(() => false);
  const [saving, setSaving] = useState(() => false);
  const [logoUploading, setLogoUploading] = useState(() => false);
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
    setLoading(() => true);
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
        setForm(() => next);
        setInitialForm(() => next);
        setBusinessId(() => data.businessId ?? null);
        setLoadError(() => null);
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Failed to load bot settings";
        setLoadError(() => message);
        push({ title: "Bot settings failed to load", message, variant: "error" });
      })
      .finally(() => {
        if (!active) return;
        setLoading(() => false);
      });

    return () => {
      active = false;
    };
  }, [push]);

  const toneExamples = useMemo(() => examples[form.tone] ?? [], [examples, form.tone]);
  const emojiTone = form.tone === "friendly" || form.tone === "energetic";
  const toneEmoji = form.tone === "energetic" ? "⚡️" : "😊";
  const withEmoji = (text: string) => {
    if (!emojiTone || /[^\x00-\x7F]/.test(text)) return text;
    return `${text} ${toneEmoji}`;
  };
  const previewGreeting = (() => {
    const base = form.greeting?.trim() ? form.greeting.trim() : "Hi! How can I help today?";
    return withEmoji(base);
  })();
  const previewExamples = toneExamples.slice(0, 3).map((example) => ({
    ...example,
    answer: withEmoji(example.answer)
  }));
  const previewTheme = form.theme ?? DEFAULT_THEME;
  const previewPrimary = previewTheme.primaryColor;
  const previewAccent = previewTheme.accentColor || previewTheme.primaryColor;
  const previewBackground = previewTheme.backgroundColor;
  const previewText = previewTheme.textColor;

  const themeDirty = (["primaryColor", "accentColor", "backgroundColor", "textColor"] as Array<keyof ThemeConfig>).some(
    (key) => form.theme[key] !== initialForm.theme[key]
  );

  const isDirty =
    form.businessName !== initialForm.businessName ||
    form.greeting !== initialForm.greeting ||
    form.tone !== initialForm.tone ||
    themeDirty;

  const handleSave = async () => {
    if (!isDirty || saving) return;
    const payload: Partial<Pick<BotSettingsResponse, "businessName" | "greeting" | "tonePreset" | "theme">> = {};
    if (form.businessName !== initialForm.businessName) {
      payload.businessName = form.businessName;
    }
    if (form.greeting !== initialForm.greeting) {
      payload.greeting = form.greeting;
    }
    if (form.tone !== initialForm.tone) {
      payload.tonePreset = form.tone;
    }
    if (themeDirty) {
      payload.theme = form.theme;
    }

    if (!Object.keys(payload).length) return;

    setSaving(() => true);
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
      const next: BotSettingsForm = {
        businessName: (data as BotSettingsResponse).businessName,
        greeting: (data as BotSettingsResponse).greeting,
        tone: (data as BotSettingsResponse).tonePreset,
        logoUrl: (data as BotSettingsResponse).logoUrl ?? null,
        theme: (data as BotSettingsResponse).theme ?? DEFAULT_THEME
      };
      setForm(() => next);
      setInitialForm(() => next);
      setBusinessId((prev) => (data as BotSettingsResponse).businessId ?? prev);
      push({ title: "Bot settings saved", message: "Your updates are live in the widget.", variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save bot settings right now.";
      push({ title: "Save failed", message, variant: "error" });
    } finally {
      setSaving(() => false);
    }
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!businessId) {
      push({ title: "Logo upload unavailable", message: "Business not loaded yet. Try again in a moment.", variant: "error" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("businessId", businessId);

    setLogoUploading(() => true);
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
        push({ title: "Logo updated", message: "Your logo is live in the widget.", variant: "success" });
      }
    } catch (error) {
      console.error("Logo upload failed", error);
      push({
        title: "Logo upload failed",
        message: error instanceof Error ? error.message : "We could not upload that logo right now.",
        variant: "error"
      });
    } finally {
      setLogoUploading(() => false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
      <div className="space-y-6">
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
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logoUrl} alt="Logo preview" className="h-full w-full object-cover" />
                </>
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
          <Button variant="primary" onClick={handleSave} disabled={!isDirty || saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
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
        <div className="rounded-3xl border border-white/10 p-5" style={{ backgroundColor: previewBackground, color: previewText }}>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color: previewText }}>
                {form.businessName}
              </p>
              <p className="text-xs" style={{ color: previewText, opacity: 0.6 }}>
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
                style={{ color: previewText }}
              >
                {previewGreeting}
              </div>
            </div>
            {previewExamples.map((example) => (
              <div key={example.question} className="space-y-3">
                <div className="flex justify-end">
                  <div
                    className="max-w-[80%] rounded-2xl px-4 py-3 text-sm text-white shadow"
                    style={{ backgroundImage: `linear-gradient(135deg, ${previewPrimary}, ${previewAccent})` }}
                  >
                    {example.question}
                  </div>
                </div>
                <div className="flex">
                  <div
                    className="max-w-[80%] rounded-2xl bg-white/10 px-4 py-3 text-sm shadow"
                    style={{ color: previewText }}
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
