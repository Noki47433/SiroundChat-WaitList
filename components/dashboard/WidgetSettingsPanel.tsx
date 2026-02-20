"use client";

import { WidgetSettingsForm } from "@/components/dashboard/WidgetSettingsForm";
import { useWidget } from "@/hooks/useWidget";

interface WidgetSettingsPanelProps {
  siteId: string;
}

export function WidgetSettingsPanel({ siteId }: WidgetSettingsPanelProps) {
  const { config, loading, update } = useWidget(siteId);

  if (loading || !config) {
    return <p className="text-white/60">Loading widget settings...</p>;
  }

  return (
    <WidgetSettingsForm
      defaultValues={{
        primaryColor: config.theme.primary,
        greeting: config.greeting,
        launcherPosition: config.launcherPosition,
        showLogo: config.showLogo
      }}
      onSave={async (values) => {
        await update({
          theme: { ...config.theme, primary: values.primaryColor },
          greeting: values.greeting,
          launcherPosition: values.launcherPosition,
          showLogo: values.showLogo
        });
      }}
    />
  );
}
