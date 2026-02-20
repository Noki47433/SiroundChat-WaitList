"use client";

import Link from "next/link";
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
  const [publishNeedsUpgrade, setPublishNeedsUpgrade] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const handlePublish = async () => {
    if (!canPublish) return;
    setIsPublishing(true);
    setError(null);
    setPublishNeedsUpgrade(false);

    try {
      const response = await fetch("/api/builder/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 403 && payload?.code === "PLAN_UPGRADE_REQUIRED") {
          setError(payload?.error ?? "Your current plan does not include website publishing.");
          setPublishNeedsUpgrade(true);
          return;
        }
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
          setPublishNeedsUpgrade(false);
          setConfirmOpen(true);
        }}
        disabled={isPublishing || !canPublish}
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-yellow-400 px-5 text-sm font-semibold text-neutral-900 disabled:opacity-60"
      >
        {isPublishing ? "Publishing..." : currentUrl ? "Republish" : "Publish"}
      </button>
      {currentUrl ? (
        <a
          href={currentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 px-5 text-sm font-semibold text-white"
        >
          View live site
        </a>
      ) : null}
      {!canPublish ? (
        <span className="text-xs text-white/50">Upgrade plan to publish</span>
      ) : null}
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
      {publishNeedsUpgrade ? (
        <Link
          href="/dashboard/billing?blocked=publish_website"
          className="inline-flex h-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-100 px-3 text-xs font-semibold text-amber-900"
        >
          Upgrade to publish
        </Link>
      ) : null}

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
            <li>Finish setting up your site details and domain.</li>
            <li>Share your link with customers.</li>
          </ul>
          <p>You are responsible for verifying the accuracy and legality of published content.</p>
        </div>
      </Modal>
    </div>
  );
}
