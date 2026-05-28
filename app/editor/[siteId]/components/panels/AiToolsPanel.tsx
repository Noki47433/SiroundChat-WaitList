"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FilePenLine,
  Loader2,
  Paintbrush,
  Plus,
  Sparkles,
  Type,
  Upload,
  Wand2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { selectActivePage, selectSelectedSection } from "@/lib/website-builder/editor/selectors";
import type { SiteDocument, SiteSection } from "@/lib/website-builder/types";
import { buildTheme } from "@/lib/website-builder/editor/theme";

type AiEditResultType =
  | "content_updated"
  | "theme_updated"
  | "section_added"
  | "page_added"
  | "section_updated"
  | "blocked"
  | "redirect_to_generate"
  | "clarification_needed";

type AiEditResult = {
  type: AiEditResultType;
  document?: SiteDocument;
  summary?: string;
  dataSource?: string | null;
  intent?: string;
  clarification?: {
    message: string;
    missingTypes?: string[];
  };
};

type LoadingStage =
  | "classifying"
  | "checking_docs"
  | "planning"
  | "generating"
  | "saving"
  | null;

const STAGE_LABELS: Record<NonNullable<LoadingStage>, string> = {
  classifying: "Understanding your request…",
  checking_docs: "Looking through your business documents…",
  planning: "Planning the changes…",
  generating: "Making the changes…",
  saving: "Saving your draft…",
};

const QUICK_PROMPTS: Record<string, string[]> = {
  default: [
    "Change the hero title to…",
    "Update the phone number to…",
    "Add a testimonials section",
    "Make the colors more premium",
    "Add a services page",
  ],
  restaurant: [
    "Change the hero to highlight our signature dish",
    "Update the opening hours",
    "Add a menu page",
    "Make the site feel more upscale",
    "Add a gallery section",
  ],
  dental_clinic: [
    "Add a services page with our treatments",
    "Update the booking CTA",
    "Add a FAQ section",
    "Make the site feel more clinical and trustworthy",
    "Add a team section",
  ],
  car_dealership: [
    "Add a vehicle inventory page",
    "Update the CTA to Test Drive",
    "Add a financing section",
    "Make the hero more dynamic",
    "Add testimonials",
  ],
  real_estate_agency: [
    "Add a property listings page",
    "Update the CTA to Book a Tour",
    "Make the site feel more luxury",
    "Add a team section",
    "Update the contact section",
  ],
};

const INTENT_LABEL_MAP: Record<string, string> = {
  content_edit: "Content edit",
  data_edit: "Data update",
  theme_token_edit: "Theme change",
  style_refinement: "Style refinement",
  section_addition: "Add section",
  section_regeneration: "Redesign section",
  page_addition: "Add page",
  knowledge_based_page_generation: "Add page from data",
  knowledge_based_section_generation: "Add section from data",
  translation_edit: "Translation",
  navigation_edit: "Navigation edit",
  full_regeneration: "Full regeneration",
  seo_copy_edit: "SEO edit",
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `section-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function AiToolsPanel() {
  const { push: pushToast } = useToast();
  const state = useEditorState();
  const { updateDocument, setSelectedNode } = useEditorActions();
  const activePage = selectActivePage(state);
  const selectedSection = selectSelectedSection(state);

  const [prompt, setPrompt] = useState("");
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(null);
  const [lastResult, setLastResult] = useState<AiEditResult | null>(null);
  const [busyLegacy, setBusyLegacy] = useState<"section" | "page" | "selected" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = loadingStage !== null;
  const trimmedPrompt = prompt.trim();
  const businessType = (state.document?.siteBrief as any)?.businessType ?? "default";

  const handleAiEdit = async () => {
    if (!trimmedPrompt || !state.document || !state.siteId) return;

    setLoadingStage("classifying");
    setLastResult(null);

    const simulateStages = async () => {
      await delay(600);
      setLoadingStage("checking_docs");
      await delay(500);
      setLoadingStage("planning");
      await delay(400);
      setLoadingStage("generating");
    };

    const stagePromise = simulateStages();

    try {
      const response = await fetch("/api/builder/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: state.siteId,
          prompt: trimmedPrompt,
          pageId: activePage?.id,
          sectionId: selectedSection?.id,
        }),
      });

      await stagePromise;
      setLoadingStage("saving");
      await delay(300);

      const data = await response.json();
      setLoadingStage(null);

      if (!response.ok) {
        setLastResult({
          type: "clarification_needed",
          clarification: { message: data.error ?? "Something went wrong. Please try again." },
        });
        return;
      }

      const result: AiEditResult = data.result;
      setLastResult(result);

      if (result.type === "clarification_needed" || result.type === "blocked" || result.type === "redirect_to_generate") {
        return;
      }

      if (result.document) {
        updateDocument(() => result.document!);
      }

      if (result.type === "page_added") {
        pushToast({ title: "Page added", message: result.summary ?? "New page created.", variant: "success" });
        setPrompt("");
      } else if (result.type === "section_added") {
        pushToast({ title: "Section added", message: result.summary ?? "New section added.", variant: "success" });
        setPrompt("");
      } else if (result.type === "theme_updated") {
        pushToast({ title: "Theme updated", message: result.summary ?? "Theme applied.", variant: "success" });
        setPrompt("");
      } else {
        pushToast({ title: "Updated", message: result.summary ?? "Changes applied.", variant: "success" });
        setPrompt("");
      }
    } catch (error) {
      await stagePromise.catch(() => null);
      setLoadingStage(null);
      setLastResult({
        type: "clarification_needed",
        clarification: { message: "Connection error. Please try again." },
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAiEdit();
    }
  };

  const regenerateSection = async (section: SiteSection, promptValue: string) => {
    const response = await fetch("/api/builder/regenerate-section-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: state.siteId,
        sectionId: section.id,
        sectionType: section.type,
        prompt: promptValue,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "Section regeneration failed");
    }
    const data = await response.json();
    if (data?.section) {
      updateDocument((doc) => ({
        ...doc,
        pages: doc.pages.map((page) =>
          page.id !== activePage?.id
            ? page
            : {
                ...page,
                sections: page.sections.map((s) =>
                  s.id !== (data.section as SiteSection).id ? s : (data.section as SiteSection)
                ),
              }
        ),
      }));
    }
  };

  const handleRewriteSelected = async () => {
    if (!selectedSection) {
      pushToast({ title: "Select a section", message: "Pick a section first, then rewrite it.", variant: "info" });
      return;
    }
    setBusyLegacy("selected");
    try {
      const promptValue = trimmedPrompt || "Rewrite the copy to feel more polished, more specific, and better matched to the site tone.";
      await regenerateSection(selectedSection, promptValue);
      pushToast({ title: "Section updated", message: "Selected section copy refreshed.", variant: "success" });
    } catch {
      pushToast({ title: "AI error", message: "Could not rewrite the selected section.", variant: "error" });
    } finally {
      setBusyLegacy(null);
    }
  };

  const handleRewritePage = async () => {
    if (!activePage) return;
    const supportedSections = activePage.sections.filter((s) =>
      ["hero", "about", "services", "testimonials", "gallery", "pricing", "faq", "cta", "contact", "footer"].includes(s.type)
    );
    if (!supportedSections.length) {
      pushToast({ title: "Nothing to rewrite", message: "This page has no rewriteable sections.", variant: "info" });
      return;
    }
    setBusyLegacy("page");
    try {
      const promptValue = trimmedPrompt || "Rewrite the copy to feel more polished, more specific, and better matched to the site tone.";
      for (const section of supportedSections) {
        await regenerateSection(section, promptValue);
      }
      pushToast({ title: "Page refreshed", message: "All sections on this page were updated.", variant: "success" });
    } catch {
      pushToast({ title: "AI error", message: "Could not refresh the whole page.", variant: "error" });
    } finally {
      setBusyLegacy(null);
    }
  };

  const quickPrompts = QUICK_PROMPTS[businessType] ?? QUICK_PROMPTS.default;

  return (
    <div className="space-y-3 p-1">
      {/* Main AI edit card */}
      <div className="rounded-[22px] border border-[#eadfcd] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(255,247,235,0.90))] shadow-[0_12px_40px_rgba(84,62,23,0.07)]">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-[#b5862a]" />
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-sc-muted">AI Website Editor</span>
          </div>

          <textarea
            ref={textareaRef}
            className="w-full min-h-[100px] resize-none rounded-[16px] border border-[#e8dece] bg-white/80 px-4 py-3 text-sm text-sc-text placeholder:text-[#c4b89a] focus:border-[#d4b472] focus:outline-none focus:ring-0 transition-colors"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me what to change…&#10;e.g. &quot;Add a menu page&quot; or &quot;Change the hero title to…&quot;"
            disabled={isLoading || busyLegacy !== null}
          />

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-[#c4b89a]">
              ⌘ + Enter to send
            </p>
            <button
              type="button"
              onClick={handleAiEdit}
              disabled={!trimmedPrompt || isLoading || busyLegacy !== null}
              className="inline-flex items-center gap-2 rounded-[14px] bg-[#1a1a1a] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#2d2d2d] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Working…</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>Apply</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading progress */}
        {isLoading && loadingStage && (
          <div className="border-t border-[#eadfcd] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#b5862a] shrink-0" />
              <p className="text-xs text-sc-muted">{STAGE_LABELS[loadingStage]}</p>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#f0e8d8]">
              <div
                className="h-full rounded-full bg-[#d4b472] transition-all duration-500"
                style={{
                  width: loadingStage === "classifying" ? "20%" :
                         loadingStage === "checking_docs" ? "40%" :
                         loadingStage === "planning" ? "60%" :
                         loadingStage === "generating" ? "80%" : "95%",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Result feedback */}
      {lastResult && !isLoading && (
        <ResultCard result={lastResult} onDismiss={() => setLastResult(null)} />
      )}

      {/* Quick prompt suggestions */}
      {!isLoading && !lastResult && (
        <div className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sc-muted">Quick ideas</p>
          {quickPrompts.slice(0, 3).map((qp) => (
            <button
              key={qp}
              type="button"
              disabled={isLoading || busyLegacy !== null}
              onClick={() => {
                setPrompt(qp);
                textareaRef.current?.focus();
              }}
              className="flex w-full items-center gap-2 rounded-[14px] border border-[#ede4d5] bg-white px-3 py-2 text-left text-xs text-sc-muted transition hover:border-[#d9c49f] hover:text-sc-text disabled:opacity-50"
            >
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{qp}</span>
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-2 px-1">
        <div className="h-px flex-1 bg-[#ede4d5]" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#c4b89a]">Quick actions</span>
        <div className="h-px flex-1 bg-[#ede4d5]" />
      </div>

      {/* Legacy quick actions */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleRewritePage}
          disabled={isLoading || busyLegacy !== null}
          className="w-full rounded-[18px] border border-[#eadfcd] bg-white p-3.5 text-left shadow-sm transition hover:border-[#d9c49f] disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <FilePenLine className="mt-0.5 h-4 w-4 shrink-0 text-sc-muted" />
            <div>
              <p className="text-xs font-semibold text-sc-text">
                {busyLegacy === "page" ? "Refreshing page…" : "Refresh whole page copy"}
              </p>
              <p className="mt-0.5 text-[11px] text-sc-muted">
                Rewrite every section on the current page.
              </p>
            </div>
            {busyLegacy === "page" && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-sc-muted" />}
          </div>
        </button>

        <button
          type="button"
          onClick={handleRewriteSelected}
          disabled={isLoading || busyLegacy !== null}
          className="w-full rounded-[18px] border border-[#eadfcd] bg-white p-3.5 text-left shadow-sm transition hover:border-[#d9c49f] disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <Type className="mt-0.5 h-4 w-4 shrink-0 text-sc-muted" />
            <div>
              <p className="text-xs font-semibold text-sc-text">
                {busyLegacy === "selected" ? "Rewriting…" : "Rewrite selected section"}
              </p>
              <p className="mt-0.5 text-[11px] text-sc-muted">
                {selectedSection ? `Rewrite the ${selectedSection.type} section.` : "Select a section first."}
              </p>
            </div>
            {busyLegacy === "selected" && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-sc-muted" />}
          </div>
        </button>
      </div>
    </div>
  );
}

function ResultCard({ result, onDismiss }: { result: AiEditResult; onDismiss: () => void }) {
  if (result.type === "clarification_needed") {
    return (
      <div className="rounded-[18px] border border-[#f5d5a0] bg-[#fffbf0] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fef3c7]">
            <BookOpen className="h-3.5 w-3.5 text-[#b45309]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#92400e]">More information needed</p>
            <p className="mt-1 text-xs text-[#a16207] leading-relaxed">
              {result.clarification?.message}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex items-center gap-1 rounded-[10px] border border-[#fcd34d] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#92400e] transition hover:bg-[#fef9ee]"
              >
                <Upload className="h-3 w-3" />
                Upload document
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-[10px] px-3 py-1.5 text-[11px] text-[#a16207] transition hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (result.type === "blocked") {
    return (
      <div className="rounded-[18px] border border-[#fecaca] bg-[#fff5f5] p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ef4444]" />
          <div>
            <p className="text-xs font-semibold text-[#b91c1c]">Request blocked</p>
            <p className="mt-1 text-xs text-[#dc2626]">{result.clarification?.message}</p>
            <button type="button" onClick={onDismiss} className="mt-2 text-[11px] text-[#b91c1c] underline">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (result.type === "redirect_to_generate") {
    return (
      <div className="rounded-[18px] border border-[#e0e7ff] bg-[#f5f7ff] p-4">
        <div className="flex items-start gap-3">
          <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4f46e5]" />
          <div>
            <p className="text-xs font-semibold text-[#3730a3]">Use the generate flow</p>
            <p className="mt-1 text-xs text-[#4338ca]">{result.clarification?.message}</p>
            <button type="button" onClick={onDismiss} className="mt-2 text-[11px] text-[#4338ca] underline">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSuccess = ["content_updated", "theme_updated", "section_added", "page_added", "section_updated"].includes(result.type);

  if (isSuccess) {
    return (
      <div className="rounded-[18px] border border-[#bbf7d0] bg-[#f0fdf4] p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#15803d]">
              {result.type === "page_added" ? "Page added" :
               result.type === "section_added" ? "Section added" :
               result.type === "theme_updated" ? "Theme updated" :
               "Changes applied"}
            </p>
            {result.summary && (
              <p className="mt-0.5 text-xs text-[#16a34a]">{result.summary}</p>
            )}
            {result.dataSource && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-[#15803d]">
                <BookOpen className="h-3 w-3" />
                Source: {result.dataSource}
              </p>
            )}
            {result.intent && INTENT_LABEL_MAP[result.intent] && (
              <span className="mt-2 inline-flex items-center rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-medium text-[#15803d]">
                {INTENT_LABEL_MAP[result.intent]}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-[11px] text-[#15803d] underline"
          >
            Clear
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
