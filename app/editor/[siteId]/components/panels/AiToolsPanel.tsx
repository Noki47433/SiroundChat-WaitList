"use client";

import { useState } from "react";
import { ArrowRight, FilePenLine, Type } from "lucide-react";
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
  const [busyAction, setBusyAction] = useState<"section" | "theme" | "page" | "selected" | null>(null);
  const trimmedPrompt = prompt.trim();
  const defaultSectionPrompt = trimmedPrompt || "Add a more premium, better structured section that matches this site.";
  const defaultRewritePrompt = trimmedPrompt || "Rewrite the copy to feel more polished, more specific, and better matched to the site tone.";

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

  const replaceSection = (nextSection: SiteSection) => {
    if (!activePage) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) =>
        page.id !== activePage.id
          ? page
          : {
              ...page,
              sections: page.sections.map((section) => (section.id === nextSection.id ? nextSection : section))
            }
      )
    }));
  };

  const regenerateSection = async (section: SiteSection, promptValue: string) => {
    const response = await fetch("/api/builder/regenerate-section-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: state.siteId,
        sectionId: section.id,
        sectionType: section.type,
        prompt: promptValue
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "Section regeneration failed");
    }
    const data = await response.json();
    if (data?.section) {
      replaceSection(data.section as SiteSection);
    }
  };

  const handleGenerateSection = async () => {
    if (!state.document) return;
    setBusyAction("section");
    try {
      const response = await fetch("/api/builder/section-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: defaultSectionPrompt, theme: state.document.theme })
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
      setBusyAction(null);
    }
  };

  const handleThemeAssistant = async () => {
    if (!state.document) return;
    setBusyAction("theme");
    try {
      const response = await fetch("/api/builder/theme-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt || "Refresh the site theme to feel more refined and on-brand.", theme: state.document.theme })
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
      setBusyAction(null);
    }
  };

  const handleRewriteSelected = async () => {
    if (!selectedSection) {
      pushToast({ title: "Select a section", message: "Pick a section first, then rewrite it.", variant: "info" });
      return;
    }
    setBusyAction("selected");
    try {
      await regenerateSection(selectedSection, defaultRewritePrompt);
      pushToast({ title: "Section updated", message: "Selected section copy was refreshed.", variant: "success" });
    } catch (error) {
      console.error("[EDITOR_AI_REWRITE_SELECTED]", error);
      pushToast({ title: "AI error", message: "Could not rewrite the selected section.", variant: "error" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRewritePage = async () => {
    if (!activePage) return;
    const supportedSections = activePage.sections.filter((section) =>
      ["hero", "about", "services", "testimonials", "gallery", "pricing", "faq", "cta", "contact", "footer"].includes(section.type)
    );
    if (!supportedSections.length) {
      pushToast({ title: "Nothing to rewrite", message: "This page has no rewriteable sections yet.", variant: "info" });
      return;
    }
    setBusyAction("page");
    try {
      for (const section of supportedSections) {
        await regenerateSection(section, defaultRewritePrompt);
      }
      pushToast({ title: "Page copy refreshed", message: "The current page copy was updated.", variant: "success" });
    } catch (error) {
      console.error("[EDITOR_AI_REWRITE_PAGE]", error);
      pushToast({ title: "AI error", message: "Could not refresh the whole page copy.", variant: "error" });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[#eadfcd] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,247,235,0.88))] p-4 shadow-[0_18px_50px_rgba(84,62,23,0.06)]">
        <label className="text-xs font-semibold uppercase tracking-[0.24em] text-sc-muted">Describe your goal</label>
        <textarea
          className="mt-3 min-h-[120px] w-full rounded-[22px] border border-[#eadfcd] bg-white px-4 py-3 text-sm text-sc-text placeholder:text-sc-muted shadow-inner"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="e.g. Add a premium gallery section with more editorial spacing"
        />
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={handleGenerateSection}
            disabled={busyAction !== null}
            className="inline-flex items-center justify-between rounded-[18px] border border-[#e1d5c0] bg-white px-4 py-3 text-sm font-semibold text-sc-text shadow-sm disabled:opacity-50"
          >
            {busyAction === "section" ? "Creating section..." : "Create a full section"}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleThemeAssistant}
            disabled={busyAction !== null}
            className="inline-flex items-center justify-between rounded-[18px] border border-[#e1d5c0] bg-white px-4 py-3 text-sm font-semibold text-sc-text shadow-sm disabled:opacity-50"
          >
            {busyAction === "theme" ? "Refreshing theme..." : "Redesign your site theme"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleRewritePage}
          disabled={busyAction !== null}
          className="w-full rounded-[22px] border border-[#eadfcd] bg-white p-4 text-left shadow-sm transition hover:border-[#d9c49f] disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <FilePenLine className="mt-1 h-5 w-5 text-sc-text" />
            <div>
              <p className="text-sm font-semibold text-sc-text">Get new text for your whole page</p>
              <p className="text-xs text-sc-muted">
                Refresh every section on the current page from one prompt.
              </p>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={handleRewriteSelected}
          disabled={busyAction !== null}
          className="w-full rounded-[22px] border border-[#eadfcd] bg-white p-4 text-left shadow-sm transition hover:border-[#d9c49f] disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <Type className="mt-1 h-5 w-5 text-sc-text" />
            <div>
              <p className="text-sm font-semibold text-sc-text">Rewrite the selected section</p>
              <p className="text-xs text-sc-muted">Use the current prompt to improve the section you picked.</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
