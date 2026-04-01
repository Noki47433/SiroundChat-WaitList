"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

type BuilderOverviewActionsProps = {
  siteId: string;
  publishedUrl: string | null;
  canPublish: boolean;
};

export function BuilderOverviewActions({ siteId, publishedUrl, canPublish }: BuilderOverviewActionsProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(publishedUrl);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const handlePublish = async () => {
    if (!canPublish) return;
    setIsPublishing(true);
    setError(null);

    try {
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
      setCurrentUrl(data.url ?? null);
      setSuccessOpen(true);
    } catch (publishError) {
      console.error("[BUILDER_PUBLISH_ERROR]", publishError);
      setError("Unable to publish. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => {
          if (!canPublish) return;
          setError(null);
          setConfirmOpen(true);
        }}
        disabled={isPublishing || !canPublish}
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#ffe169] to-[#f3b012] px-5 text-sm font-semibold text-[#2d1c00] shadow-[0_14px_28px_rgba(255,191,63,0.32)] transition hover:brightness-105 disabled:opacity-60"
      >
        {isPublishing ? "Publishing..." : currentUrl ? "Republish" : "Publish"}
      </button>
      {currentUrl ? (
        <a
          href={currentUrl}
          target="_blank"
          rel="noreferrer"
          className="dashboard-pill inline-flex h-11 items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-semibold text-white"
        >
          View live site
        </a>
      ) : null}
      {!canPublish ? (
        <span className="text-xs text-white/50">Publishing is unavailable right now.</span>
      ) : null}
      {error ? <span className="text-xs text-red-300">{error}</span> : null}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Ready to publish?"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                handlePublish();
              }}
              disabled={isPublishing}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-emerald-950 disabled:opacity-60"
            >
              {isPublishing ? "Publishing..." : "Publish"}
            </button>
          </>
        }
      >
        <p>Publishing makes your latest edits live to visitors immediately.</p>
        <ul className="list-disc space-y-2 pl-5 text-xs text-white/70">
          <li>Review the accuracy of your content before it goes live.</li>
          <li>You are responsible for verifying the accuracy and legality of published content.</li>
        </ul>
      </Modal>

      <Modal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Your site is published"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSuccessOpen(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white"
            >
              Close
            </button>
            {currentUrl ? (
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white"
              >
                View live site
              </a>
            ) : null}
          </>
        }
      >
        <p>Congratulations! Your site is live online.</p>
        {currentUrl ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
            {currentUrl}
          </div>
        ) : null}
        <div className="space-y-2 text-xs text-white/70">
          <p className="font-semibold text-white">What&apos;s next</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Finish your site details, SEO, and business info.</li>
            <li>Share your link with customers.</li>
          </ul>
          <p>You are responsible for verifying the accuracy and legality of published content.</p>
        </div>
      </Modal>
    </div>
  );
}
