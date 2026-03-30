// app/embed/[siteId]/page.tsx
// Purpose: Render the SiroundChat widget inside an iframe with ZERO background bleed
// - Guarantees greeting + theme are never undefined
// - Forces iframe + page to be fully transparent
// - Does NOT touch launcher behavior or sizing logic

import { headers } from "next/headers";
import { WidgetRoot } from "@/components/chat-widget/WidgetRoot";
import type { WidgetConfig, WidgetTheme } from "@/lib/types/core";

const DEFAULT_THEME: WidgetTheme = {
  primary: "#00A3FF",
  background: "#0B1222",
  text: "#FFFFFF",
  secondary: "#111827",
  shape: "rounded",
};

const DEFAULT_GREETING = "Pershendetje! Si mund t'ju ndihmoj sot?";

async function fetchConfig(siteId: string): Promise<WidgetConfig | null> {
  try {
    const headerList = headers();
    const host =
      headerList.get("x-forwarded-host")?.split(",")[0]?.trim() ??
      headerList.get("host")?.split(",")[0]?.trim() ??
      null;
    const protocol =
      headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      (process.env.NODE_ENV === "production" ? "https" : "http");

    if (!host) {
      return null;
    }

    const res = await fetch(`${protocol}://${host}/api/widget/config?key=${siteId}`, { cache: "no-store" });

    if (!res.ok) return null;

    return (await res.json().catch(() => null)) as WidgetConfig | null;
  } catch {
    return null;
  }
}

export default async function EmbedPage({
  params,
}: {
  params: { siteId: string };
}) {
  const config = await fetchConfig(params.siteId);

  if (!config) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center bg-transparent text-xs text-white/70"
        style={{ background: "transparent" }}
      >
        Widget not found.
      </div>
    );
  }

  // 🔒 GUARANTEE NON-UNDEFINED VALUES
  const greeting = config.greeting || DEFAULT_GREETING;
  const theme = config.theme || DEFAULT_THEME;

  return (
    <div
      className="h-screen w-screen bg-transparent"
      style={{ background: "transparent" }}
    >
      {/* HARD RESET: nothing inside iframe is allowed to paint a background */}
      

      <WidgetRoot
        siteId={params.siteId}
        greeting={greeting}
        tonePreset={config?.tonePreset}
        theme={theme}
        launcherVariant={config?.launcherVariant ?? "iconWithLabel"}
        logoUrl={config?.logoUrl ?? undefined}
        iconId={config?.iconId ?? undefined}
        businessName={config?.businessName ?? "Chatbot"}
      />
    </div>
  );
}
