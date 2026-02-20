"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  tags?: string[];
  preferences?: Record<string, unknown>;
  last_seen_at?: string | null;
};

export default function CrmDashboardClient() {
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [secondaryMergeId, setSecondaryMergeId] = useState("");

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editPreferences, setEditPreferences] = useState("{}");

  const loadCustomers = async (nextSearch = search) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/crm/customers?search=${encodeURIComponent(nextSearch)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load customers");
      }

      const rows = payload.customers ?? [];
      setCustomers(rows);
      if (!selectedCustomerId && rows.length) {
        setSelectedCustomerId(rows[0].id);
      }
    } catch (error) {
      push({ title: "Load failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (customerId: string) => {
    try {
      const response = await fetch(`/api/crm/customers?customerId=${encodeURIComponent(customerId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load profile");
      }
      setProfile(payload);

      const customer = payload.customer as Customer;
      setEditName(customer?.name ?? "");
      setEditEmail(customer?.email ?? "");
      setEditPhone(customer?.phone ?? "");
      setEditTags(Array.isArray(customer?.tags) ? customer.tags.join(", ") : "");
      setEditPreferences(JSON.stringify(customer?.preferences ?? {}, null, 2));
    } catch (error) {
      push({ title: "Load profile failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
      setProfile(null);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      void loadProfile(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const customerOptions = useMemo(() => customers.filter((item) => item.id !== selectedCustomerId), [customers, selectedCustomerId]);

  const saveProfile = async () => {
    if (!selectedCustomerId) return;
    setSaving(true);

    let preferences: Record<string, unknown> = {};
    try {
      preferences = JSON.parse(editPreferences);
    } catch {
      push({ title: "Invalid JSON", message: "Preferences must be valid JSON", variant: "error" });
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/crm/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          name: editName || null,
          email: editEmail || null,
          phone: editPhone || null,
          tags: editTags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          preferences
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to save customer");
      }
      push({ title: "Saved", message: "Customer profile updated", variant: "success" });
      await loadCustomers();
      await loadProfile(selectedCustomerId);
    } catch (error) {
      push({ title: "Save failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const mergeCustomers = async () => {
    if (!selectedCustomerId || !secondaryMergeId) return;
    setSaving(true);

    try {
      const response = await fetch("/api/crm/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryCustomerId: selectedCustomerId,
          secondaryCustomerId: secondaryMergeId
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to merge customers");
      }

      push({ title: "Merged", message: "Duplicate customer merged", variant: "success" });
      setSecondaryMergeId("");
      await loadCustomers();
      await loadProfile(selectedCustomerId);
    } catch (error) {
      push({ title: "Merge failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="space-y-3">
        <Input
          placeholder="Search by name, email, phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void loadCustomers(event.currentTarget.value);
            }
          }}
        />
        <Button size="sm" variant="outline" onClick={() => void loadCustomers(search)} disabled={loading}>
          Search
        </Button>

        <div className="space-y-2">
          {customers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => setSelectedCustomerId(customer.id)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                selectedCustomerId === customer.id
                  ? "border-emerald-400/40 bg-emerald-500/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <p className="font-medium">{customer.name ?? customer.email ?? customer.phone ?? "Unnamed customer"}</p>
              <p className="text-xs text-white/60">{customer.email ?? customer.phone ?? "No contact details"}</p>
            </button>
          ))}
          {!customers.length ? <p className="text-sm text-white/60">No customers found.</p> : null}
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Customer Profile</h3>
          {!selectedCustomerId ? <p className="text-sm text-white/60">Select a customer.</p> : null}

          {selectedCustomerId ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Name" />
                <Input value={editEmail} onChange={(event) => setEditEmail(event.target.value)} placeholder="Email" />
                <Input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} placeholder="Phone" />
                <Input value={editTags} onChange={(event) => setEditTags(event.target.value)} placeholder="Tags (comma separated)" />
              </div>
              <Textarea
                value={editPreferences}
                onChange={(event) => setEditPreferences(event.target.value)}
                placeholder="Preferences JSON"
                rows={6}
              />
              <Button onClick={saveProfile} disabled={saving}>
                Save profile
              </Button>
            </>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Merge Duplicate Customers</h3>
          <p className="text-sm text-white/60">Keep selected customer as primary and merge another profile into it.</p>
          <select
            value={secondaryMergeId}
            onChange={(event) => setSecondaryMergeId(event.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-neutral-900/70 px-3 text-sm text-white"
          >
            <option value="">Select duplicate customer</option>
            {customerOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name ?? customer.email ?? customer.phone ?? customer.id}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={mergeCustomers} disabled={saving || !secondaryMergeId || !selectedCustomerId}>
            Merge customer
          </Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Timeline</h3>
          {(profile?.timeline ?? []).length ? (
            <div className="space-y-2">
              {profile.timeline.map((event: any) => (
                <div key={event.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  <p className="font-medium">{event.type}</p>
                  <p className="text-xs text-white/60">{new Date(event.created_at).toLocaleString()}</p>
                  <pre className="mt-2 overflow-auto rounded-lg bg-black/30 p-2 text-xs text-white/70">
                    {JSON.stringify(event.payload ?? {}, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/60">No timeline events yet.</p>
          )}
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-3">
            <h3 className="text-lg font-semibold">Reservations</h3>
            {(profile?.reservations ?? []).length ? (
              profile.reservations.map((reservation: any) => (
                <div key={reservation.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  <p className="font-medium">{reservation.customer_name}</p>
                  <p className="text-xs text-white/60">
                    {new Date(reservation.datetime).toLocaleString()} • {reservation.status}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/60">No reservations found.</p>
            )}
          </Card>

          <Card className="space-y-3">
            <h3 className="text-lg font-semibold">Feedback History</h3>
            {(profile?.feedback ?? []).length ? (
              profile.feedback.map((feedback: any) => (
                <div key={feedback.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  <p className="font-medium">Rating: {feedback.rating}</p>
                  <p className="text-xs text-white/60">{new Date(feedback.created_at).toLocaleString()}</p>
                  {feedback.comment ? <p className="mt-1 text-white/80">{feedback.comment}</p> : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-white/60">No feedback yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
