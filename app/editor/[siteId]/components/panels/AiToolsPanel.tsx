"use client";

import { useState } from "react";
import { ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { selectActivePage, selectSelectedSection } from "@/lib/website-builder/editor/selectors";
import type { SiteSection } from "@/lib/website-builder/types";
import { buildTheme } from "@/lib/website-builder/editor/theme";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `section-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function AiToolsPanel() {
  const { push: pushToast } = useToast();
  const state = useEditorState();
  const { updateDocument, setSelectedNode } = useEditorActions();
  const activePage = selectActivePage(state);
  const selectedSection = selectSelectedSection(state);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const insertSection = (section: SiteSection) => {
    if (!activePage) return;
    const nextSection = { ...section, id: section.id ?? createId() };
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => {
        if (page.id !== activePage.id) return page;
        const sections = [...page.sections];
        const insertIndex = selectedSection
          ? Math.max(0, sections.findIndex((item) => item.id === selectedSection.id) + 1)
          : sections.length;
        sections.splice(insertIndex, 0, nextSection);
        return { ...page, sections };
      })
    }));
    setSelectedNode({ type: "section", id: nextSection.id, parentId: activePage.id });
  };

  const handleGenerateSection = async () => {
    if (!prompt.trim() || !state.document) return;
    setLoading(true);
    try {
      const response = await fetch("/api/builder/section-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), theme: state.document.theme })
      });
      if (!response.ok) throw new Error("Section generation failed");
      const data = await response.json();
      if (data?.section) {
        insertSection(data.section as SiteSection);
        pushToast({ title: "Section created", message: "AI section added to the page.", variant: "success" });
      }
    } catch (error) {
      console.error("[EDITOR_AI_SECTION]", error);
      pushToast({ title: "AI error", message: "Try again in a moment.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleThemeAssistant = async () => {
    if (!prompt.trim() || !state.document) return;
    setLoading(true);
    try {
      const response = await fetch("/api/builder/theme-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), theme: state.document.theme })
      });
      if (!response.ok) throw new Error("Theme assistant failed");
      const data = await response.json();
      if (data?.theme) {
        const nextPrimary = data.theme.primary ?? data.theme.primaryColor ?? state.document.theme.primary;
        const nextBackground = data.theme.background ?? data.theme.bg ?? state.document.theme.bg;
        const nextFont = data.theme.fontFamily ?? data.theme.fontBody ?? state.document.theme.fontBody;
        updateDocument((doc) => ({
          ...doc,
          theme: buildTheme(nextPrimary, nextBackground, nextFont)
        }));
        pushToast({ title: "Theme updated", message: "AI suggestions applied.", variant: "success" });
      }
    } catch (error) {
      console.error("[EDITOR_AI_THEME]", error);
      pushToast({ title: "AI error", message: "Try again in a moment.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sc-border bg-sc-surface p-3">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Describe your goal</label>
        <textarea
          className="mt-2 min-h-[90px] w-full rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-sm text-sc-text placeholder:text-sc-muted"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="e.g. Add a premium services section for a boutique studio"
        />
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={handleGenerateSection}
            disabled={loading}
            className="inline-flex items-center justify-between rounded-xl border border-sc-border px-3 py-2 text-xs font-semibold text-sc-text"
          >
            Create a full section
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleThemeAssistant}
            disabled={loading}
            className="inline-flex items-center justify-between rounded-xl border border-sc-border px-3 py-2 text-xs font-semibold text-sc-text"
          >
            Redesign your site theme
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-sc-border bg-sc-surface p-3">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-5 w-5 text-sc-text" />
            <div>
              <p className="text-sm font-semibold text-sc-text">Get new text for your whole page</p>
              <p className="text-xs text-sc-muted">
                Instantly replace copy from a short description.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-sc-border bg-sc-surface p-3">
          <div className="flex items-start gap-3">
            <Wand2 className="mt-1 h-5 w-5 text-sc-text" />
            <div>
              <p className="text-sm font-semibold text-sc-text">Add or edit any text you want</p>
              <p className="text-xs text-sc-muted">Improve the words you already have.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
