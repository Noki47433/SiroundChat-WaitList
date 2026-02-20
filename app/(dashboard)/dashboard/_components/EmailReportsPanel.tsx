"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { EmailReportSettings } from "@/lib/types";
import { getEmailReportSettings, saveEmailReportSettings, sendEmailReport } from "@/lib/api";

export function EmailReportsPanel({ initial }: { initial: EmailReportSettings }) {
  const { push } = useToast();
  const [settings, setSettings] = useState(initial);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    getEmailReportSettings().then((stored) => {
      if (active) setSettings(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = (checked: boolean) => {
    setSettings((prev) => ({ ...prev, enabled: checked }));
    push({
      title: checked ? "Reports enabled" : "Reports paused",
      message: "You can update recipients anytime.",
      variant: "info"
    });
  };

  const handleSave = async () => {
    const updated = await saveEmailReportSettings(settings);
    setSettings(updated);
    push({ title: "Settings saved", message: "Monthly email preferences updated.", variant: "success" });
  };

  const handleSendPreview = async () => {
    setSending(true);
    await sendEmailReport(settings.recipient);
    setSending(false);
    push({ title: "Preview sent", message: "Email preview delivered (mock).", variant: "success" });
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Monthly report</p>
            <p className="text-xs text-white/60">Send a summary of conversations and leads.</p>
          </div>
          <Toggle checked={settings.enabled} onChange={handleToggle} label="Monthly report toggle" />
        </div>
        <label className="text-sm text-white/70">
          Recipient email
          <Input
            value={settings.recipient}
            onChange={(event) => setSettings((prev) => ({ ...prev, recipient: event.target.value }))}
            placeholder="reports@company.com"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={handleSave}>
            Save settings
          </Button>
          <Button variant="outline" onClick={handleSendPreview} disabled={sending}>
            {sending ? "Sending..." : "Send preview"}
          </Button>
        </div>
      </Card>

      <Card>
        <p className="text-sm font-semibold">Monthly email preview</p>
        <p className="mt-2 text-xs text-white/60">{settings.preview.subject}</p>
        <p className="mt-4 text-sm text-white/80">{settings.preview.summary}</p>
        <ul className="mt-4 space-y-2 text-sm text-white/70">
          {settings.preview.highlights.map((item) => (
            <li key={item} className="rounded-xl border border-white/10 bg-white/5 p-3">
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
