"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { AccountProfile } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const timezones = [
  "Europe/Skopje",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "Asia/Dubai"
];

export function AccountPanel({ initial }: { initial: AccountProfile }) {
  const router = useRouter();
  const { push } = useToast();
  const [profile, setProfile] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, timezone: profile.timezone })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to save profile");
      }
      setProfile(payload);
      push({ title: "Profile updated", message: "Account details saved.", variant: "success" });
    } catch (error) {
      push({
        title: "Update failed",
        message: error instanceof Error ? error.message : "Could not save profile right now.",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLogoutOpen(false);
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) {
      push({ title: "Logout failed", message: error.message, variant: "error" });
      return;
    }
    push({ title: "Logged out", message: "Redirecting to sign in.", variant: "success" });
    router.push("/auth");
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <p className="text-sm font-semibold">Profile details</p>
          <p className="text-xs text-white/60">Update how your team sees you inside SiroundChat.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-white/70">
            Full name
            <Input
              value={profile.name}
              onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label className="text-sm text-white/70">
            Email address
            <Input
              type="email"
              value={profile.email}
              readOnly
              disabled
            />
            <span className="mt-1 block text-xs text-white/45">Email changes are managed through your auth provider.</span>
          </label>
          <label className="text-sm text-white/70">
            Timezone
            <Select
              value={profile.timezone}
              onChange={(event) => setProfile((prev) => ({ ...prev, timezone: event.target.value }))}
            >
              {timezones.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving} data-tutorial-target="account-save">
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </Card>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Session</p>
          <p className="text-xs text-white/60">Sign out of the dashboard on this device.</p>
        </div>
        <Button variant="outline" onClick={() => setLogoutOpen(true)}>
          Sign out
        </Button>
      </Card>

      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Sign out from SiroundChat?"
        footer={
          <>
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleLogout()}>
              Sign out
            </Button>
          </>
        }
      >
        You can sign back in anytime using your email and password.
      </Modal>
    </div>
  );
}
