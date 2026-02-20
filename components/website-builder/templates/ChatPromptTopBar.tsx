"use client";

import { useEffect, useMemo, useState } from "react";

export const DEFAULT_CHAT_PROMPT_TEXT = "Have questions or want to make a reservation? Use our chatbot →";
export const DEFAULT_CHAT_PROMPT_CTA = "Open chat";

const DISMISS_KEY = "siround_chat_prompt_dismissed_until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type ChatPromptTopBarProps = {
  enabled?: boolean;
  text?: string | null;
  ctaLabel?: string | null;
  onOpenChat?: () => void;
};

const resolveCopy = (value: string | null | undefined, fallback: string) => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : fallback;
};

export function ChatPromptTopBar({
  enabled,
  text,
  ctaLabel,
  onOpenChat
}: ChatPromptTopBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  const resolvedText = useMemo(() => resolveCopy(text, DEFAULT_CHAT_PROMPT_TEXT), [text]);
  const resolvedCta = useMemo(() => resolveCopy(ctaLabel, DEFAULT_CHAT_PROMPT_CTA), [ctaLabel]);

  useEffect(() => {
    if (!enabled) {
      setDismissed(false);
      setReady(true);
      return;
    }
    if (typeof window === "undefined") return;
    let hidden = false;
    try {
      const stored = window.localStorage.getItem(DISMISS_KEY);
      if (stored) {
        const until = Number(stored);
        if (!Number.isNaN(until) && Date.now() < until) {
          hidden = true;
        }
      }
    } catch {
      // ignore storage errors
    }
    setDismissed(hidden);
    setReady(true);
  }, [enabled]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window === "undefined") return;
    try {
      const until = Date.now() + DISMISS_MS;
      window.localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      // ignore storage errors
    }
  };

  if (!enabled || dismissed || !ready) return null;

  return (
    <div className="sticky top-0 z-40 h-12 border-b border-[color:var(--site-border)]/60 bg-[color:var(--site-surface)]">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3 px-4">
        <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--site-text)]">
          {resolvedText}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[color:var(--site-primary)] px-3 text-xs font-semibold text-[color:var(--site-buttonText)]"
          >
            {resolvedCta}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--site-border)]/60 text-[color:var(--site-text)]"
            aria-label="Dismiss"
          >
            <span className="text-base leading-none">×</span>
          </button>
        </div>
      </div>
    </div>
  );
}
