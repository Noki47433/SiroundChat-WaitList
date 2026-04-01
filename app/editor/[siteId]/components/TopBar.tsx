"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Eye,
  Grid,
  Redo2,
  Save,
  Search,
  Undo2,
  Ruler,
  ZoomIn
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { selectActivePage } from "@/lib/website-builder/editor/selectors";
import { buildPublishedSiteUrl } from "@/lib/utils/published-site-url";

type TopBarProps = {
  siteId: string;
  businessName: string;
  slug: string;
  canPublish: boolean;
  publishedUrl: string | null;
  onPublished: (url: string | null) => void;
};

const ZOOM_PRESETS = [
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1 }
];

export function TopBar({ siteId, businessName, slug, canPublish, publishedUrl, onPublished }: TopBarProps) {
  const { push: pushToast } = useToast();
  const state = useEditorState();
  const {
    setActivePage,
    setGuides,
    setGrid,
    setViewport,
    setZoom,
    undo,
    redo
  } = useEditorActions();
  const activePage = selectActivePage(state);
  const pages = state.document?.pages ?? [];
  const documentSignature = useMemo(() => JSON.stringify(state.document ?? {}), [state.document]);
  const [savedSignature, setSavedSignature] = useState(() => documentSignature);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishUrl, setPublishUrl] = useState<string | null>(publishedUrl);

  const isDirty = savedSignature !== documentSignature;
  const defaultLiveUrl = useMemo(() => buildPublishedSiteUrl(slug), [slug]);

  useEffect(() => {
    setPublishUrl(publishedUrl);
  }, [publishedUrl]);

  const saveDraft = async () => {
    if (!state.document || saveState === "saving") return false;
    setSaveState("saving");
    try {
      const response = await fetch("/api/builder/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, siteDocument: state.document })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Save failed");
      }
      setSavedSignature(documentSignature);
      setSaveState("saved");
      pushToast({ title: "Saved", message: "Draft updated.", variant: "success" });
      return true;
    } catch (error) {
      console.error("[EDITOR_SAVE_ERROR]", error);
      setSaveState("error");
      pushToast({
        title: "Save failed",
        message: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "error"
      });
      return false;
    } finally {
      window.setTimeout(() => setSaveState("idle"), 1500);
    }
  };

  const publishSite = async () => {
    if (!canPublish) return;
    try {
      if (isDirty) {
        const saved = await saveDraft();
        if (!saved) return;
      }
      const response = await fetch("/api/builder/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Publish failed");
      }
      const data = await response.json();
      const nextUrl = data.url ?? defaultLiveUrl;
      onPublished(nextUrl);
      setPublishUrl(nextUrl);
      setPublishModalOpen(true);
      pushToast({ title: "Published", message: "Your site is live.", variant: "success" });
    } catch (error) {
      console.error("[EDITOR_PUBLISH_ERROR]", error);
      pushToast({ title: "Publish failed", message: "Try again in a moment.", variant: "error" });
    }
  };

  const openPreview = async () => {
    if (isDirty) {
      const saved = await saveDraft();
      if (!saved) return;
    }
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyUrl = async () => {
    if (!publishUrl) return;
    try {
      await navigator.clipboard.writeText(publishUrl);
      pushToast({ title: "Copied", message: "URL copied to clipboard.", variant: "success" });
    } catch {
      pushToast({ title: "Copy failed", message: "Could not copy URL.", variant: "error" });
    }
  };

  const previewUrl = `/s/${slug}?preview=true&siteId=${siteId}&page=${activePage?.slug ?? "home"}`;

  return (
    <>
      <header className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 border-b border-sc-border bg-sc-surface px-4 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <div className="min-w-0 max-w-[220px]">
          <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Website Editor</span>
          <span className="block truncate text-sm font-semibold text-sc-text">{businessName}</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-sc-border bg-sc-surface px-3 py-1 text-xs font-semibold">
          <span className="text-[10px] uppercase tracking-[0.2em] text-sc-muted">Page</span>
          <select
            className="bg-transparent text-xs font-semibold text-sc-text focus:outline-none"
            value={activePage?.id ?? ""}
            onChange={(event) => setActivePage(event.target.value)}
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
          <ChevronDown className="h-3 w-3 text-sc-muted" />
        </div>
        <div className="hidden min-w-0 max-w-[360px] items-center gap-2 rounded-full border border-sc-border bg-sc-surface px-3 py-1 text-xs text-sc-muted xl:flex">
          <span className="truncate">{publishUrl ?? defaultLiveUrl}</span>
        </div>
        <button
          type="button"
          onClick={openPreview}
          className="inline-flex items-center gap-2 rounded-full border border-sc-border px-3 py-1 text-xs font-semibold text-sc-text hover:bg-sc-surface-2"
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-sc-border bg-sc-surface px-3 py-1 text-xs text-sc-muted 2xl:flex">
          <Search className="h-4 w-4" />
          <input
            className="w-28 bg-transparent text-xs text-sc-text placeholder:text-sc-muted focus:outline-none xl:w-40"
            placeholder="Search"
          />
        </div>
        <button
          type="button"
          onClick={() => undo()}
          disabled={!state.history.past.length}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sc-border text-sc-text disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => redo()}
          disabled={!state.history.future.length}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sc-border text-sc-text disabled:opacity-40"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-sc-border bg-sc-surface px-2 text-xs font-semibold">
          <ZoomIn className="h-4 w-4 text-sc-muted" />
          <select
            className="bg-transparent text-xs font-semibold text-sc-text focus:outline-none"
            value={state.zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            {ZOOM_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setGuides(!state.showGuides)}
          className={`inline-flex h-9 items-center gap-2 rounded-full border border-sc-border px-3 text-xs font-semibold ${
            state.showGuides ? "bg-sc-surface-2 text-sc-text" : "text-sc-muted"
          }`}
        >
          <Ruler className="h-4 w-4" />
          Guides
        </button>
        <button
          type="button"
          onClick={() => setGrid(!state.showGrid)}
          className={`inline-flex h-9 items-center gap-2 rounded-full border border-sc-border px-3 text-xs font-semibold ${
            state.showGrid ? "bg-sc-surface-2 text-sc-text" : "text-sc-muted"
          }`}
        >
          <Grid className="h-4 w-4" />
          Grid
        </button>
        <div className="flex items-center gap-1 rounded-full border border-sc-border p-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
          {(["desktop", "mobile"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setViewport(item)}
              className={`rounded-full px-3 py-1 ${
                state.viewport === item ? "bg-sc-yellow text-sc-text" : "text-sc-muted"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={saveDraft}
          disabled={!isDirty || saveState === "saving"}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-sc-border px-4 py-2 text-xs font-semibold text-sc-text disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          {saveState === "saving" ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={publishSite}
          disabled={!canPublish}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-sc-yellow px-4 py-2 text-xs font-semibold text-sc-text disabled:opacity-50"
        >
          <ExternalLink className="h-4 w-4" />
          {publishedUrl ? "Republish" : "Publish"}
        </button>
      </div>
    </header>

    {publishModalOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur">
        <div className="w-full max-w-2xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">Published</p>
              <h2 className="mt-2 text-2xl font-semibold text-neutral-900">Your site is live</h2>
              <p className="mt-1 text-sm text-neutral-500">Share your live SiroundChat subdomain with customers.</p>
            </div>
            <button
              type="button"
              onClick={() => setPublishModalOpen(false)}
              className="text-neutral-400 transition hover:text-neutral-700"
            >
              ✕
            </button>
          </div>

          <div className="mt-6 grid gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Live URL</p>
              <p className="mt-1 truncate text-sm font-semibold text-neutral-900">
                {publishUrl ?? defaultLiveUrl}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => window.open(publishUrl ?? defaultLiveUrl, "_blank", "noopener,noreferrer")}
                className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
              >
                View site
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 rounded-2xl border border-neutral-200 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">V1 domain setup</p>
              <p className="mt-1 text-sm text-neutral-500">
                Published sites go live on your SiroundChat subdomain in v1. Custom domains stay disabled until DNS verification is fully built.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
              We disabled the old placeholder connect flow so published sites don&apos;t imply domain support before DNS verification is real.
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setPublishModalOpen(false)}
              className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-600"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
