"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface WidgetSettingsFormProps {
  defaultValues: {
    primaryColor: string;
    greeting: string;
    launcherPosition: "left" | "right";
    showLogo: boolean;
  };
  onSave: (payload: WidgetSettingsFormProps["defaultValues"]) => Promise<void>;
}

export function WidgetSettingsForm({ defaultValues, onSave }: WidgetSettingsFormProps) {
  const [values, setValues] = useState(defaultValues);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    await onSave(values);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm text-white/60">Primary color</label>
        <Input
          type="color"
          value={values.primaryColor}
          onChange={(event) => setValues((prev) => ({ ...prev, primaryColor: event.target.value }))}
        />
      </div>
      <div>
        <label className="text-sm text-white/60">Greeting</label>
        <Input value={values.greeting} onChange={(event) => setValues((prev) => ({ ...prev, greeting: event.target.value }))} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/80">Show business logo</span>
        <Switch checked={values.showLogo} onChange={(event) => setValues((prev) => ({ ...prev, showLogo: event.target.checked }))} />
      </div>
      <div>
        <label className="text-sm text-white/60">Launcher position</label>
        <select
          className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
          value={values.launcherPosition}
          onChange={(event) => setValues((prev) => ({ ...prev, launcherPosition: event.target.value as "left" | "right" }))}
        >
          <option value="right">Bottom right</option>
          <option value="left">Bottom left</option>
        </select>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save widget"}
      </Button>
    </form>
  );
}
