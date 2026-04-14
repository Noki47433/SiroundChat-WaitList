"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatWindow } from "./ChatWindow";
import { WidgetLauncher } from "./WidgetLauncher";
import type { TonePreset } from "@/lib/types";
import type { WidgetTheme } from "@/lib/types/core";
import { analytics } from "@/lib/analytics/client";

interface WidgetRootProps {
  siteId: string;
  widgetKey?: string | null; // ✅ real widget key (business widget_key)
  greeting: string;
  tonePreset?: TonePreset;
  theme: WidgetTheme;
  launcherVariant?: "icon" | "iconWithLabel";
  logoUrl?: string;
  iconId?: string;
  businessName?: string;
  defaultOpen?: boolean;
  disableAnalytics?: boolean;
}

export function WidgetRoot({
  siteId,
  widgetKey,
  greeting,
  tonePreset,
  theme,
  launcherVariant = "iconWithLabel",
  logoUrl,
  iconId,
  businessName,
  defaultOpen = false,
  disableAnalytics = false
}: WidgetRootProps) {
  const [open, setOpen] = useState(defaultOpen);

  const chatSize = { width: 360, height: 640 };
  const launcherSize = { width: 56, height: 56 };

  const openSize = useMemo(() => ({ width: chatSize.width, height: chatSize.height }), [chatSize.width, chatSize.height]);
  const closedSize = useMemo(() => ({ width: launcherSize.width, height: launcherSize.height }), [launcherSize.width, launcherSize.height]);

  const safeLogoUrl = logoUrl && logoUrl.startsWith("blob:") ? undefined : logoUrl;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const size = open ? openSize : closedSize;
    const frame = window.frameElement as HTMLIFrameElement | null;

    if (frame?.style) {
      frame.style.width = `${size.width}px`;
      frame.style.height = `${size.height}px`;
      frame.style.borderRadius = open ? "30px" : "999px";
      frame.style.background = "transparent";
    }

    window.parent?.postMessage(
      { type: "promptly-widget-resize", siteId, width: size.width, height: size.height, open, primaryColor: theme.primary },
      "*"
    );
  }, [open, siteId, theme.primary, openSize.width, openSize.height, closedSize.width, closedSize.height, closedSize, openSize]);

  useEffect(() => {
    if (disableAnalytics) return;
    if (!open) return;
    const activeKey = widgetKey ?? siteId;
    if (activeKey) {
      analytics.trackWidgetOpened(activeKey, siteId);
    }
  }, [disableAnalytics, open, siteId, widgetKey]);

  return (
    <div className="relative h-screen w-screen">
      <ChatWindow
        siteId={siteId}
        widgetKey={widgetKey ?? siteId} // ✅ no duplicate props, no hardcode nonsense
        greeting={greeting}
        tonePreset={tonePreset}
        theme={theme}
        businessName={businessName}
        logoUrl={safeLogoUrl ?? undefined}
        iconId={iconId ?? undefined}
        open={open}
        onClose={() => setOpen(() => false)}
      />

      {!open ? (
        <WidgetLauncher
          open={open}
          onClick={() => setOpen(() => true)}
          primaryColor={theme.primary}
          accentColor={theme.accent ?? theme.secondary}
          shape={theme.shape}
          variant={launcherVariant}
          logoUrl={safeLogoUrl}
          iconId={iconId ?? undefined}
          fallbackInitial={businessName?.[0]}
        />
      ) : null}
    </div>
  );
}
