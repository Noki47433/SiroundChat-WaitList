"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SiteSettingsFormProps {
  defaultName: string;
  onSave?: (payload: { name: string }) => Promise<void>;
}

export function SiteSettingsForm({ defaultName, onSave }: SiteSettingsFormProps) {
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    await onSave?.({ name });
    setMessage("Saved!");
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm text-white/60">Site name</label>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
