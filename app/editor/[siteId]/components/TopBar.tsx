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
  const [domainValue, setDomainValue] = useState("");
  const [domainStatus, setDomainStatus] = useState<"unregistered" | "pending" | "active" | null>(null);
  const [domainRecords, setDomainRecords] = useState<
    Array<{ type: string; name: string; value: string }>
  >([]);
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null);

  const isDirty = savedSignature !== documentSignature;
  const defaultLiveUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/s/${slug}`;
    }
    return `https://siround.chat/s/${slug}`;
  }, [slug]);

  useEffect(() => {
    setPublishUrl(publishedUrl);
  }, [publishedUrl]);

  useEffect(() => {
    if (!publishModalOpen) return;
    setDomainError(null);
    setDomainSuccess(null);
    fetch(`/api/domain/status?siteId=${siteId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.domain) {
          setDomainValue(data.domain);
          setDomainStatus(data.status ?? "pending");
        } else {
          setDomainStatus("unregistered");
        }
      })
      .catch(() => {
        setDomainStatus(null);
      });
  }, [publishModalOpen, siteId]);

  const saveDraft = async () => {
    if (!state.document || saveState === "saving") return;
    setSaveState("saving");
    try {
      const response = await fetch("/api/builder/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, siteDocument: state.document })
      });
      if (!response.ok) {
        throw new Error("Save failed");
      }
      setSavedSignature(documentSignature);
      setSaveState("saved");
      pushToast({ title: "Saved", message: "Draft updated.", variant: "success" });
    } catch (error) {
      console.error("[EDITOR_SAVE_ERROR]", error);
      setSaveState("error");
      pushToast({ title: "Save failed", message: "Try again in a moment.", variant: "error" });
    } finally {
      window.setTimeout(() => setSaveState("idle"), 1500);
    }
  };

  const publishSite = async () => {
    if (!canPublish) return;
    try {
      const response = await fetch("/api/builder/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 403 && payload?.code === "PLAN_UPGRADE_REQUIRED") {
          pushToast({
            title: "Upgrade required",
            message: "Your current plan does not include website publishing. Open Billing to upgrade.",
            variant: "info"
          });
          return;
        }
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

  const connectDomain = async () => {
    if (!domainValue.trim()) return;
    setDomainBusy(true);
    setDomainError(null);
    setDomainSuccess(null);
    try {
      const response = await fetch("/api/domain/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, domain: domainValue })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to connect domain");
      }
      setDomainRecords(Array.isArray(data.instructions) ? data.instructions : []);
      setDomainStatus(data.status ?? "pending");
      setDomainSuccess("Domain saved. Add the DNS records below to go live.");
    } catch (err: any) {
      setDomainError(err?.message ?? "Unable to connect domain.");
    } finally {
      setDomainBusy(false);
    }
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
      <header className="flex h-[60px] items-center justify-between gap-4 border-b border-sc-border bg-sc-surface px-4">
        <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Website Editor</span>
          <span className="text-sm font-semibold text-sc-text">{businessName}</span>
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
        <div className="hidden items-center gap-2 rounded-full border border-sc-border bg-sc-surface px-3 py-1 text-xs text-sc-muted md:flex">
          <span className="truncate">{publishUrl ?? defaultLiveUrl}</span>
        </div>
        <button
          type="button"
          onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
          className="inline-flex items-center gap-2 rounded-full border border-sc-border px-3 py-1 text-xs font-semibold text-sc-text hover:bg-sc-surface-2"
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-sc-border bg-sc-surface px-3 py-1 text-xs text-sc-muted lg:flex">
          <Search className="h-4 w-4" />
          <input
            className="w-40 bg-transparent text-xs text-sc-text placeholder:text-sc-muted focus:outline-none"
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
          className="inline-flex items-center gap-2 rounded-full border border-sc-border px-4 py-2 text-xs font-semibold text-sc-text disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          {saveState === "saving" ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={publishSite}
          disabled={!canPublish}
          className="inline-flex items-center gap-2 rounded-full bg-sc-yellow px-4 py-2 text-xs font-semibold text-sc-text disabled:opacity-50"
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
              <p className="mt-1 text-sm text-neutral-500">Share your URL or connect a custom domain.</p>
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Connect your domain
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Use your own domain for a professional look.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={domainValue}
                onChange={(event) => setDomainValue(event.target.value)}
                placeholder="www.yourdomain.com"
                className="h-11 flex-1 rounded-full border border-neutral-300 px-4 text-sm text-neutral-900"
              />
              <button
                type="button"
                onClick={connectDomain}
                disabled={domainBusy}
                className="h-11 rounded-full bg-sc-yellow px-5 text-sm font-semibold text-neutral-900 disabled:opacity-60"
              >
                {domainBusy ? "Saving..." : "Connect"}
              </button>
            </div>
            {domainStatus ? (
              <p className="text-xs text-neutral-500">
                Status: <span className="font-semibold text-neutral-700">{domainStatus}</span>
              </p>
            ) : null}
            {domainError ? <p className="text-xs text-red-500">{domainError}</p> : null}
            {domainSuccess ? <p className="text-xs text-emerald-600">{domainSuccess}</p> : null}
            {domainRecords.length ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">DNS records</p>
                <div className="mt-2 space-y-2">
                  {domainRecords.map((record, index) => (
                    <div
                      key={`${record.type}-${record.name}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2"
                    >
                      <span className="text-neutral-500">{record.type}</span>
                      <span className="font-semibold text-neutral-700">{record.name}</span>
                      <span className="text-neutral-500">{record.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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
