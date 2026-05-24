"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buildPublishedSiteUrl } from "@/lib/utils/published-site-url";

type PublishButtonWithModalProps = {
  siteId: string;
  siteName: string;
  slug: string | null;
  publishedUrl: string | null;
  lastUpdatedLabel: string;
  hasPreview: boolean;
  onBeforePublish?: () => Promise<boolean>;
  onPublished?: (url: string | null) => void;
};

export function PublishButtonWithModal({
  siteId,
  siteName,
  slug,
  publishedUrl,
  lastUpdatedLabel,
  hasPreview,
  onBeforePublish,
  onPublished
}: PublishButtonWithModalProps) {
  const { push: pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedResultUrl, setPublishedResultUrl] = useState<string | null>(null);

  const fallbackSlug = (slug ?? siteName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const liveUrl = publishedUrl ?? (fallbackSlug ? buildPublishedSiteUrl(fallbackSlug) : null);

  const checklist = useMemo(
    () => [
      { label: "Preview is ready", done: hasPreview },
      { label: "Site content has a saved draft", done: hasPreview },
      { label: "SiroundChat live URL is available", done: Boolean(liveUrl) }
    ],
    [hasPreview, liveUrl]
  );

  const handlePublish = async () => {
    if (isPublishing || !hasPreview) return;
    setIsPublishing(true);
    setError(null);

    try {
      if (onBeforePublish) {
        const canContinue = await onBeforePublish();
        if (!canContinue) {
          setError("Save failed. Fix the draft state before publishing.");
          setIsPublishing(false);
          return;
        }
      }

      const response = await fetch("/api/builder/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to publish right now.");
      }

      const nextUrl = payload?.url ?? liveUrl ?? null;
      setPublishedResultUrl(nextUrl);
      onPublished?.(nextUrl);
      pushToast({
        title: "Published",
        message: nextUrl ? `Live at ${nextUrl}` : "Your site is now live.",
        variant: "success"
      });
    } catch (publishError) {
      console.error("[GENERATION_PUBLISH_ERROR]", publishError);
      setError(
        publishError instanceof Error ? publishError.message : "Unable to publish right now."
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="md"
        onClick={() => {
          setError(null);
          setPublishedResultUrl(null);
          setOpen(true);
        }}
        disabled={!hasPreview}
        className="h-11 rounded-full bg-[#ffd34d] px-5 text-sm font-semibold text-[#111113] shadow-[0_16px_34px_rgba(255,211,77,0.28)] hover:brightness-105"
      >
        {publishedUrl ? "Republish" : "Publish"}
      </Button>

      <Modal
        open={open}
        onClose={() => {
          if (isPublishing) return;
          setOpen(false);
        }}
        title={publishedResultUrl ? "Published" : "Ready to publish?"}
        size="lg"
        footer={
          publishedResultUrl ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="rounded-full border-white/10 bg-transparent text-white hover:bg-white/5"
              >
                Done
              </Button>
              <a
                href={publishedResultUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-[#ffd34d] px-5 text-sm font-medium text-[#111113] hover:brightness-105"
              >
                Open live site
              </a>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isPublishing}
                className="rounded-full border-white/10 bg-transparent text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handlePublish()}
                disabled={!hasPreview || isPublishing}
                className="rounded-full bg-[#ffd34d] px-5 text-[#111113] hover:brightness-105"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish"
                )}
              </Button>
            </>
          )
        }
      >
        <div className="grid gap-4">
          {publishedResultUrl ? (
            <div className="grid gap-4">
              <div className="rounded-[24px] border border-emerald-500/25 bg-emerald-500/10 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <div>
                    <p className="text-base font-semibold text-white">Site is live</p>
                    <p className="mt-1 leading-6 text-white/75">
                      The current draft was published successfully. This is the real live URL.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                  Published URL
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <a
                    href={publishedResultUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sm text-white/85 underline-offset-4 hover:text-white hover:underline"
                  >
                    {publishedResultUrl}
                  </a>
                  <div className="flex items-center gap-2">
                    <CopyButton
                      value={publishedResultUrl}
                      label="Copy URL"
                      copiedLabel="Copied"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-white/10 bg-transparent text-white hover:bg-white/5"
                    />
                    <a
                      href={publishedResultUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!publishedResultUrl ? (
            <>
              <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
                {checklist.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <CheckCircle2
                        className={item.done ? "h-4 w-4 text-[#ffd34d]" : "h-4 w-4 text-white/25"}
                      />
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                    Site name
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">{siteName}</p>
                </div>
                <div className="sm:col-span-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                    Domain
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-white/80">
                    <Globe className="h-4 w-4 text-[#ffd34d]" />
                    <span className="truncate">{liveUrl ?? "Reserved on publish"}</span>
                  </div>
                </div>
                <div className="sm:col-span-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                    Last updated
                  </p>
                  <p className="mt-2 text-sm text-white/80">{lastUpdatedLabel}</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#6a5314] bg-[#2a220b] p-4 text-sm text-[#f6e7b2]">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#ffd34d]" />
                  <div>
                    <p className="font-semibold text-white">Before you publish</p>
                    <p className="mt-1 leading-6 text-[#f6e7b2]">
                      Publishing makes the current site live immediately. Verify content accuracy,
                      reservation details, and live links before continuing.
                    </p>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-[20px] border border-[#5d2a2a] bg-[#221416] p-4 text-sm text-[#fecaca]">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f87171]" />
                    <div>{error}</div>
                  </div>
                </div>
              ) : null}

              {publishedUrl ? (
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  View current live site
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
