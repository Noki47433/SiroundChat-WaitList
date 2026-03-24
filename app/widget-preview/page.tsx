import { WidgetRoot } from "@/components/chat-widget/WidgetRoot";
import type { TonePreset } from "@/lib/types";
import type { WidgetTheme } from "@/lib/types/core";

export const dynamic = "force-dynamic";

const DEFAULT_THEME: WidgetTheme = {
  primary: "#00A3FF",
  background: "#0B1222",
  text: "#FFFFFF",
  secondary: "#111827",
  shape: "rounded"
};

const resolveTonePreset = (value?: string | string[]): TonePreset | undefined => {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    candidate === "professional" ||
    candidate === "friendly" ||
    candidate === "luxury" ||
    candidate === "short_direct" ||
    candidate === "energetic"
  ) {
    return candidate;
  }
  return undefined;
};

const resolveValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) ?? "";

export default function WidgetPreviewPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const businessName = resolveValue(searchParams?.businessName) || "Your business";
  const greeting =
    resolveValue(searchParams?.greeting) ||
    "Hi there. I can help with bookings, pricing, and quick questions.";
  const logoUrl = resolveValue(searchParams?.logoUrl) || undefined;
  const defaultOpen = resolveValue(searchParams?.state) === "open";

  const theme: WidgetTheme = {
    primary: resolveValue(searchParams?.primaryColor) || DEFAULT_THEME.primary,
    secondary: resolveValue(searchParams?.accentColor) || DEFAULT_THEME.secondary,
    background: resolveValue(searchParams?.backgroundColor) || DEFAULT_THEME.background,
    text: resolveValue(searchParams?.textColor) || DEFAULT_THEME.text,
    shape: "rounded"
  };

  return (
    <>
      <style>{`html, body { background: transparent !important; }`}</style>
      <div className="h-screen w-screen bg-transparent" style={{ background: "transparent" }}>
        <WidgetRoot
          siteId={`widget-preview-${defaultOpen ? "open" : "closed"}`}
          greeting={greeting}
          tonePreset={resolveTonePreset(searchParams?.tone)}
          theme={theme}
        launcherVariant="icon"
        logoUrl={logoUrl}
        businessName={businessName}
        defaultOpen={defaultOpen}
        disableAnalytics
      />
      </div>
    </>
  );
}
