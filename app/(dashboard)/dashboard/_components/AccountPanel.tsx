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
import { saveAccountProfile } from "@/lib/api";

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
    const updated = await saveAccountProfile(profile);
    setProfile(updated);
    setSaving(false);
    push({ title: "Profile updated", message: "Account details saved.", variant: "success" });
  };

  const handleLogout = () => {
    setLogoutOpen(false);
    push({ title: "Signed out (mock)", message: "Redirecting to login.", variant: "info" });
    router.push("/login");
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
              onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
            />
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
            <Button variant="primary" onClick={handleLogout}>
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
