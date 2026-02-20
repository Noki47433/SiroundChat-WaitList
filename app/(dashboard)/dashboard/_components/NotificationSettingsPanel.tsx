"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type NotificationSettings = {
  deliver_in_app: boolean;
  deliver_push: boolean;
  min_severity_to_toast: "info" | "success" | "warning" | "critical" | "celebration";
  currency: string;
  avg_order_value: number | null;
  close_rate: number | null;
};

export function NotificationSettingsPanel({
  businessId,
  initial
}: {
  businessId: string;
  initial: NotificationSettings;
}) {
  const { push } = useToast();
  const [form, setForm] = useState(() => ({
    deliver_in_app: initial.deliver_in_app,
    deliver_push: initial.deliver_push,
    min_severity_to_toast: initial.min_severity_to_toast,
    currency: initial.currency ?? "EUR",
    avg_order_value: initial.avg_order_value?.toString() ?? "",
    close_rate: initial.close_rate?.toString() ?? ""
  }));
  const [saving, setSaving] = useState(false);

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const avgOrderValue = form.avg_order_value.trim() === "" ? null : Number(form.avg_order_value);
    const closeRate = form.close_rate.trim() === "" ? null : Number(form.close_rate);

    if (avgOrderValue !== null && Number.isNaN(avgOrderValue)) {
      push({ title: "Invalid average order value", message: "Enter a valid number.", variant: "error" });
      return;
    }
    if (closeRate !== null && Number.isNaN(closeRate)) {
      push({ title: "Invalid close rate", message: "Enter a valid decimal (e.g. 0.2).", variant: "error" });
      return;
    }

    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await (supabase as any)
      .from("business_notification_settings")
      .update({
        deliver_in_app: form.deliver_in_app,
        deliver_push: form.deliver_push,
        min_severity_to_toast: form.min_severity_to_toast,
        currency: form.currency.trim().toUpperCase() || "EUR",
        avg_order_value: avgOrderValue,
        close_rate: closeRate
      })
      .eq("business_id", businessId);
    setSaving(false);

    if (error) {
      push({ title: "Failed to save settings", message: error.message, variant: "error" });
      return;
    }

    push({ title: "Settings saved", message: "Your notification preferences were updated.", variant: "success" });
  };

  return (
    <Card className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Notifications & revenue estimates</h3>
        <p className="mt-1 text-sm text-white/60">
          Set your averages to unlock monthly revenue insights and control in-app alerts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs text-white/60">
          Average order value
          <Input
            value={form.avg_order_value}
            onChange={(event) => updateField("avg_order_value", event.target.value)}
            placeholder="e.g. 120"
            className="mt-2"
          />
        </label>
        <label className="text-xs text-white/60">
          Close rate (decimal)
          <Input
            value={form.close_rate}
            onChange={(event) => updateField("close_rate", event.target.value)}
            placeholder="e.g. 0.25"
            className="mt-2"
          />
        </label>
        <label className="text-xs text-white/60">
          Currency code
          <Input
            value={form.currency}
            onChange={(event) => updateField("currency", event.target.value)}
            placeholder="EUR"
            className="mt-2"
          />
        </label>
        <label className="text-xs text-white/60">
          Toast severity threshold
          <Select
            value={form.min_severity_to_toast}
            onChange={(event) => updateField("min_severity_to_toast", event.target.value)}
            className="mt-2"
          >
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
            <option value="celebration">Celebration</option>
          </Select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-3 text-sm text-white/70">
          <Switch
            checked={form.deliver_in_app}
            onChange={(event) => updateField("deliver_in_app", event.target.checked)}
          />
          Deliver in-app notifications
        </label>
        <label className="flex items-center gap-3 text-sm text-white/70">
          <Switch
            checked={form.deliver_push}
            onChange={(event) => updateField("deliver_push", event.target.checked)}
          />
          Allow browser push alerts
        </label>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} disabled={saving} type="button">
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </Card>
  );
}
