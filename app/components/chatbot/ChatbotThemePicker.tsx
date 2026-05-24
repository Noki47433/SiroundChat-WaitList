'use client';

import { useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ThemeConfig } from "./chatbotTypes";

type ChatbotThemePickerProps = {
  theme: ThemeConfig;
  onThemeChange: (theme: ThemeConfig) => void;
};

type ThemeSwatch = {
  label: string;
  vibe: string;
  dark: boolean;
  theme: ThemeConfig;
};

const SWATCHES: ThemeSwatch[] = [
  // Dark palettes
  {
    label: "Midnight Neon",
    vibe: "Dark · Electric blue",
    dark: true,
    theme: { primaryColor: "#312E81", accentColor: "#22D3EE", backgroundColor: "#0F172A", textColor: "#E5E7EB" },
  },
  {
    label: "Forest Night",
    vibe: "Dark · Earthy green",
    dark: true,
    theme: { primaryColor: "#115E59", accentColor: "#65A30D", backgroundColor: "#0B2221", textColor: "#E2E8F0" },
  },
  {
    label: "Midnight Purple",
    vibe: "Dark · Deep violet",
    dark: true,
    theme: { primaryColor: "#7C3AED", accentColor: "#A855F7", backgroundColor: "#090618", textColor: "#F8FAFC" },
  },
  {
    label: "Ocean Steel",
    vibe: "Dark · Deep navy",
    dark: true,
    theme: { primaryColor: "#0369A1", accentColor: "#38BDF8", backgroundColor: "#020C16", textColor: "#E0F2FE" },
  },
  {
    label: "Ruby Noir",
    vibe: "Dark · Bold red",
    dark: true,
    theme: { primaryColor: "#DC2626", accentColor: "#F87171", backgroundColor: "#1A0505", textColor: "#FFF5F5" },
  },
  {
    label: "Royal Indigo",
    vibe: "Dark · Rich blue",
    dark: true,
    theme: { primaryColor: "#4338CA", accentColor: "#818CF8", backgroundColor: "#06061A", textColor: "#E0E7FF" },
  },
  {
    label: "Espresso",
    vibe: "Dark · Warm amber",
    dark: true,
    theme: { primaryColor: "#92400E", accentColor: "#F59E0B", backgroundColor: "#1A0E06", textColor: "#FEF3C7" },
  },
  {
    label: "Alpine Blue",
    vibe: "Dark · Mountain sky",
    dark: true,
    theme: { primaryColor: "#1D4ED8", accentColor: "#60A5FA", backgroundColor: "#040D22", textColor: "#DBEAFE" },
  },
  {
    label: "Cyber Lime",
    vibe: "Dark · Vivid green",
    dark: true,
    theme: { primaryColor: "#4D7C0F", accentColor: "#84CC16", backgroundColor: "#071105", textColor: "#ECFCCB" },
  },
  {
    label: "Coral Sunset",
    vibe: "Dark · Warm orange",
    dark: true,
    theme: { primaryColor: "#EA580C", accentColor: "#FB923C", backgroundColor: "#1A0800", textColor: "#FFF7ED" },
  },
  {
    label: "Rose Quartz",
    vibe: "Dark · Deep rose",
    dark: true,
    theme: { primaryColor: "#BE185D", accentColor: "#F9A8D4", backgroundColor: "#1A0510", textColor: "#FDF2F8" },
  },
  {
    label: "Luxury Black",
    vibe: "Dark · Slate on black",
    dark: true,
    theme: { primaryColor: "#94A3B8", accentColor: "#CBD5E1", backgroundColor: "#000000", textColor: "#F1F5F9" },
  },
  {
    label: "Champagne",
    vibe: "Dark · Gold warmth",
    dark: true,
    theme: { primaryColor: "#C49A6C", accentColor: "#D4AF7A", backgroundColor: "#100D08", textColor: "#FFFBF0" },
  },
  // Light palettes
  {
    label: "Ocean Breeze",
    vibe: "Light · Sky blue",
    dark: false,
    theme: { primaryColor: "#0EA5E9", accentColor: "#22D3EE", backgroundColor: "#E0F2FE", textColor: "#0F172A" },
  },
  {
    label: "Emerald Glow",
    vibe: "Light · Fresh green",
    dark: false,
    theme: { primaryColor: "#10B981", accentColor: "#22D3EE", backgroundColor: "#ECFDF3", textColor: "#0F172A" },
  },
  {
    label: "Indigo Pulse",
    vibe: "Light · Cool violet",
    dark: false,
    theme: { primaryColor: "#4F46E5", accentColor: "#A855F7", backgroundColor: "#EEF2FF", textColor: "#0F172A" },
  },
  {
    label: "Sunset Bloom",
    vibe: "Light · Pink coral",
    dark: false,
    theme: { primaryColor: "#EC4899", accentColor: "#F97316", backgroundColor: "#FFF1F2", textColor: "#1F2937" },
  },
  {
    label: "Blush Gold",
    vibe: "Light · Warm amber",
    dark: false,
    theme: { primaryColor: "#F59E0B", accentColor: "#FBBF24", backgroundColor: "#FFF7E6", textColor: "#1F2937" },
  },
  {
    label: "Dental Clean",
    vibe: "Light · Clinical fresh",
    dark: false,
    theme: { primaryColor: "#0EA5E9", accentColor: "#67E8F9", backgroundColor: "#EFF6FF", textColor: "#0C4A6E" },
  },
  {
    label: "Soft Lavender",
    vibe: "Light · Gentle violet",
    dark: false,
    theme: { primaryColor: "#7C3AED", accentColor: "#C4B5FD", backgroundColor: "#F5F3FF", textColor: "#1E1B4B" },
  },
  {
    label: "Graphite Minimal",
    vibe: "Light · Clean slate",
    dark: false,
    theme: { primaryColor: "#374151", accentColor: "#9CA3AF", backgroundColor: "#F9FAFB", textColor: "#111827" },
  },
  {
    label: "Slate Minimal",
    vibe: "Light · Ink minimal",
    dark: false,
    theme: { primaryColor: "#0F172A", accentColor: "#64748B", backgroundColor: "#F8FAFC", textColor: "#0F172A" },
  },
];

function isActiveTheme(a: ThemeConfig, b: ThemeConfig) {
  return (
    a.primaryColor === b.primaryColor &&
    a.accentColor === b.accentColor &&
    a.backgroundColor === b.backgroundColor &&
    a.textColor === b.textColor
  );
}

export function ChatbotThemePicker({ theme, onThemeChange }: ChatbotThemePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [activeTab, setActiveTab] = useState<"dark" | "light">("dark");

  const handleField = (field: keyof ThemeConfig, value: string) => {
    onThemeChange({ ...theme, [field]: value });
  };

  const darkSwatches = SWATCHES.filter((s) => s.dark);
  const lightSwatches = SWATCHES.filter((s) => !s.dark);
  const visibleSwatches = activeTab === "dark" ? darkSwatches : lightSwatches;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
          <Palette className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Color theme</p>
          <p className="text-xs text-white/40">Choose a palette or dial in custom colors</p>
        </div>
      </div>

      {/* Selected preview strip */}
      <div
        className="flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3"
        style={{ background: `linear-gradient(135deg, ${theme.primaryColor}18, ${theme.accentColor}0a)` }}
      >
        <div className="flex items-center gap-1.5">
          {[theme.primaryColor, theme.accentColor, theme.backgroundColor, theme.textColor].map((color, i) => (
            <span
              key={i}
              className="h-6 w-6 rounded-full border-2 border-black/20 shadow-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white/70 truncate">
            {SWATCHES.find((s) => isActiveTheme(s.theme, theme))?.label ?? "Custom"}
          </p>
          <p className="text-[10px] text-white/35">
            {SWATCHES.find((s) => isActiveTheme(s.theme, theme))?.vibe ?? theme.primaryColor}
          </p>
        </div>
        <div
          className="h-8 w-16 shrink-0 rounded-xl border border-white/10"
          style={{ backgroundImage: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})` }}
        />
      </div>

      {/* Dark / Light tabs */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {(["dark", "light"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-all",
              activeTab === tab
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/40 hover:text-white/70"
            )}
          >
            {tab === "dark" ? "🌙 Dark" : "☀️ Light"}
          </button>
        ))}
      </div>

      {/* Palette grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visibleSwatches.map((swatch) => {
          const isActive = isActiveTheme(swatch.theme, theme);
          return (
            <button
              key={swatch.label}
              type="button"
              onClick={() => onThemeChange(swatch.theme)}
              className={cn(
                "group relative flex flex-col gap-2 rounded-2xl border p-3 text-left transition-all duration-150",
                isActive
                  ? "border-sky-500/70 bg-sky-500/10 shadow-[0_0_0_1px_rgba(14,165,233,0.4)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              )}
            >
              {/* Gradient swatch */}
              <div
                className="h-10 w-full rounded-xl border border-white/10 shadow-inner"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${swatch.theme.primaryColor}, ${swatch.theme.accentColor})`,
                }}
              />
              <div className="min-w-0">
                <p className={cn("truncate text-[12px] font-semibold leading-tight", isActive ? "text-sky-200" : "text-white/80")}>
                  {swatch.label}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-white/35">{swatch.vibe}</p>
              </div>
              {isActive && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 shadow">
                  <Check className="h-2.5 w-2.5 text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom colors toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className="flex items-center gap-2 text-xs text-white/40 transition hover:text-white/70"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showCustom && "rotate-180")} />
          {showCustom ? "Hide custom colors" : "Custom colors"}
        </button>

        {showCustom && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(
              [
                { key: "primaryColor", label: "Primary" },
                { key: "accentColor", label: "Accent" },
                { key: "backgroundColor", label: "Background" },
                { key: "textColor", label: "Text" },
              ] as { key: keyof ThemeConfig; label: string }[]
            ).map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1.5 text-[11px] font-medium text-white/50">
                {label}
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                  <span
                    className="h-5 w-5 shrink-0 rounded-md border border-white/10"
                    style={{ backgroundColor: theme[key] }}
                  />
                  <input
                    type="color"
                    value={theme[key]}
                    onChange={(e) => handleField(key, e.target.value)}
                    className="h-5 w-full cursor-pointer appearance-none border-0 bg-transparent p-0 outline-none"
                    aria-label={`${label} color`}
                  />
                  <span className="text-[10px] font-mono text-white/30">{theme[key].toUpperCase()}</span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
