"use client";

import { useMemo } from "react";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { buildTheme } from "@/lib/website-builder/editor/theme";

const FONT_OPTIONS = [
  "Sora, Inter, system-ui, sans-serif",
  "Manrope, Inter, system-ui, sans-serif",
  '"Space Grotesk", Inter, system-ui, sans-serif',
  '"Playfair Display", Inter, system-ui, sans-serif'
];

export function ThemePanel() {
  const state = useEditorState();
  const { updateDocument } = useEditorActions();
  const theme = state.document?.theme;

  const currentFont = useMemo(() => {
    if (!theme) return FONT_OPTIONS[0];
    const match = FONT_OPTIONS.find((font) => font === theme.fontBody || font === theme.fontHeading);
    return match ?? theme.fontBody ?? theme.fontHeading ?? FONT_OPTIONS[0];
  }, [theme]);

  if (!theme) {
    return <p className="text-sm text-sc-muted">No theme loaded.</p>;
  }

  const applyTheme = (primary: string, background: string, fontFamily?: string) => {
    updateDocument((doc) => ({
      ...doc,
      theme: buildTheme(primary, background, fontFamily ?? currentFont)
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Theme</p>
        <p className="mt-1 text-xs text-sc-muted">Adjust colors and typography.</p>
      </div>

      <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Primary color
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-10 w-12 rounded-lg border border-sc-border bg-sc-surface"
            value={theme.primary}
            onChange={(event) => applyTheme(event.target.value, theme.bg, currentFont)}
          />
          <input
            className="h-10 flex-1 rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
            value={theme.primary}
            onChange={(event) => applyTheme(event.target.value, theme.bg, currentFont)}
          />
        </div>
      </label>

      <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Background color
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-10 w-12 rounded-lg border border-sc-border bg-sc-surface"
            value={theme.bg}
            onChange={(event) => applyTheme(theme.primary, event.target.value, currentFont)}
          />
          <input
            className="h-10 flex-1 rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
            value={theme.bg}
            onChange={(event) => applyTheme(theme.primary, event.target.value, currentFont)}
          />
        </div>
      </label>

      <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Font
        <select
          className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
          value={currentFont}
          onChange={(event) => applyTheme(theme.primary, theme.bg, event.target.value)}
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font}>
              {font.split(",")[0].replace(/\"/g, "")}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-xs text-sc-muted">
        Tip: Use AI Tools to get a full theme refresh if you want a new palette.
      </div>
    </div>
  );
}
