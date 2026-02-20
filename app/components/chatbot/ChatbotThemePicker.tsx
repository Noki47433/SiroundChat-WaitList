// Summary: Secondary color picker for chatbot theme values.
'use client';

import { ThemeConfig } from "./chatbotTypes";

type ChatbotThemePickerProps = {
  theme: ThemeConfig;
  onThemeChange: (theme: ThemeConfig) => void;
};

type ThemeSwatch = { label: string; theme: ThemeConfig };

const SWATCHES: ThemeSwatch[] = [
  { label: "Ocean Breeze", theme: { primaryColor: "#0EA5E9", accentColor: "#22D3EE", backgroundColor: "#E0F2FE", textColor: "#0F172A" } },
  { label: "Sunset Bloom", theme: { primaryColor: "#EC4899", accentColor: "#F97316", backgroundColor: "#FFF1F2", textColor: "#1F2937" } },
  { label: "Emerald Glow", theme: { primaryColor: "#10B981", accentColor: "#22D3EE", backgroundColor: "#ECFDF3", textColor: "#0F172A" } },
  { label: "Indigo Pulse", theme: { primaryColor: "#4F46E5", accentColor: "#A855F7", backgroundColor: "#EEF2FF", textColor: "#0F172A" } },
  { label: "Blush Gold", theme: { primaryColor: "#F59E0B", accentColor: "#FBBF24", backgroundColor: "#FFF7E6", textColor: "#1F2937" } },
  { label: "Midnight Neon", theme: { primaryColor: "#312E81", accentColor: "#22D3EE", backgroundColor: "#0F172A", textColor: "#E5E7EB" } },
  { label: "Coral Mint", theme: { primaryColor: "#FB7185", accentColor: "#22D3EE", backgroundColor: "#FFF0F3", textColor: "#0F172A" } },
  { label: "Forest Night", theme: { primaryColor: "#115E59", accentColor: "#65A30D", backgroundColor: "#0B2221", textColor: "#E2E8F0" } },
  { label: "Slate Minimal", theme: { primaryColor: "#0F172A", accentColor: "#64748B", backgroundColor: "#F8FAFC", textColor: "#0F172A" } }
];

export function ChatbotThemePicker({ theme, onThemeChange }: ChatbotThemePickerProps) {
  const handleField = (field: keyof ThemeConfig, value: string) => {
    onThemeChange({ ...theme, [field]: value });
  };

  const renderSwatch = (swatch: ThemeSwatch) => {
    const isActive =
      swatch.theme.primaryColor === theme.primaryColor &&
      swatch.theme.accentColor === theme.accentColor &&
      swatch.theme.backgroundColor === theme.backgroundColor &&
      swatch.theme.textColor === theme.textColor;

    return (
      <button
        key={swatch.label}
        type="button"
        onClick={() => onThemeChange(swatch.theme)}
        className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition ${
          isActive
            ? "border-sky-400 bg-sky-500/10 text-sky-100 shadow-[0_12px_32px_rgba(14,165,233,0.2)]"
            : "border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-400/60"
        }`}
      >
        <div>
          <p className="text-sm font-semibold">{swatch.label}</p>
          <p className="text-xs text-slate-400">Primary {swatch.theme.primaryColor.toUpperCase()}</p>
        </div>
        <span
          className="h-12 w-16 rounded-xl border border-white/20 shadow-inner"
          style={{
            backgroundImage: `linear-gradient(135deg, ${swatch.theme.primaryColor}, ${swatch.theme.accentColor})`
          }}
          aria-label={`Apply ${swatch.label}`}
        />
      </button>
    );
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">Theme &amp; colors</p>
        <span className="rounded-full bg-sky-500/15 px-3 py-1 text-[11px] font-semibold text-sky-100">More themes added</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs text-slate-300">
          Primary color
          <input
            type="color"
            value={theme.primaryColor}
            onChange={(event) => handleField("primaryColor", event.target.value)}
            className="h-10 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-800"
            aria-label="Primary color"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs text-slate-300">
          Accent color
          <input
            type="color"
            value={theme.accentColor}
            onChange={(event) => handleField("accentColor", event.target.value)}
            className="h-10 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-800"
            aria-label="Accent color"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs text-slate-300">
          Background
          <input
            type="color"
            value={theme.backgroundColor}
            onChange={(event) => handleField("backgroundColor", event.target.value)}
            className="h-10 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-800"
            aria-label="Background color"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs text-slate-300">
          Text
          <input
            type="color"
            value={theme.textColor}
            onChange={(event) => handleField("textColor", event.target.value)}
            className="h-10 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-800"
            aria-label="Text color"
          />
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Signature palettes</p>
        <div className="grid gap-3 md:grid-cols-2">{SWATCHES.map(renderSwatch)}</div>
      </div>
    </div>
  );
}
