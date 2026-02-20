"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GA_ID, track } from "@/src/lib/analytics/ga";

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const pagePath = search ? `${pathname}?${search}` : pathname;
  const firedDepthsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!GA_ID || typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }

    window.gtag("config", GA_ID, { page_path: pagePath });
  }, [pagePath]);

  useEffect(() => {
    if (!GA_ID) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest("a") as HTMLAnchorElement | null;

      if (!link?.href || !link.href.startsWith("http")) {
        return;
      }

      if (link.href.includes("siroundchat.com")) {
        return;
      }

      track("outbound_click", {
        link_url: link.href,
        link_text: link.textContent?.trim() || undefined
      });
    };

    document.addEventListener("click", handleDocumentClick);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    if (!GA_ID || typeof window === "undefined") {
      return;
    }

    const thresholds = [25, 50, 75, 100] as const;
    const firedDepths = new Set<number>();
    firedDepthsRef.current = firedDepths;

    const handleScroll = () => {
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - doc.clientHeight;
      if (maxScroll <= 0) {
        return;
      }

      const percent = Math.min(100, Math.round((window.scrollY / maxScroll) * 100));

      for (const threshold of thresholds) {
        if (percent >= threshold && !firedDepths.has(threshold)) {
          firedDepths.add(threshold);
          track("scroll_depth", { percent: threshold });
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pagePath]);

  return null;
}
