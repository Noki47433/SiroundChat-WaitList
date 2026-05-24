"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { submitReservationRequest } from "@/components/templates/shared/reservation-submit";

type ReservationRequestDialogProps = {
  siteId?: string | null;
  slug?: string | null;
  title?: string;
  description?: string;
  submitLabel?: string;
  brandName?: string;
  logoUrl?: string | null;
  renderTrigger: (controls: { open: () => void }) => ReactNode;
};

export function ReservationRequestDialog({
  siteId,
  slug,
  title = "Request a reservation",
  description = "Send your preferred date, time, and party size. The restaurant will confirm availability.",
  submitLabel = "Send request",
  brandName,
  logoUrl,
  renderTrigger
}: ReservationRequestDialogProps) {
  const { push: pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    time: "",
    partySize: "2",
    notes: ""
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      await submitReservationRequest({
        siteId,
        slug,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        date: form.date,
        time: form.time,
        partySize: form.partySize,
        notes: form.notes || null
      });

      pushToast({
        title: "Reservation request sent",
        message: "The request was saved and sent to the dashboard.",
        variant: "success"
      });
      setOpen(false);
      setForm({
        name: "",
        email: "",
        phone: "",
        date: "",
        time: "",
        partySize: "2",
        notes: ""
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit reservation request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {renderTrigger({ open: () => setOpen(true) })}
      <Dialog
        open={open}
        onClose={() => (submitting ? null : setOpen(false))}
        title={title}
        overlayClassName="px-4"
        panelClassName="border"
        panelStyle={{
          background: "var(--site-surface, #111315)",
          borderColor: "var(--site-border, rgba(255,255,255,0.12))",
          color: "var(--site-text, #f8fafc)"
        }}
        titleClassName="pr-8"
        contentClassName=""
      >
        {(brandName || logoUrl) && (
          <div
            className="mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3"
            style={{
              borderColor: "var(--site-border, rgba(255,255,255,0.12))",
              background: "var(--site-surface-strong, rgba(255,255,255,0.04))"
            }}
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={`${brandName ?? "Restaurant"} logo`}
                width={44}
                height={44}
                unoptimized
                className="h-11 w-11 rounded-xl object-contain"
              />
            ) : null}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--site-muted, #a1a1aa)" }}>
                Reservations
              </p>
              <p className="text-sm font-semibold" style={{ color: "var(--site-text, #f8fafc)" }}>
                {brandName ?? "Restaurant"}
              </p>
            </div>
          </div>
        )}
        <p className="mb-5 leading-6" style={{ color: "var(--site-muted, #a1a1aa)" }}>
          {description}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Name"
              required
              className="h-11 rounded-2xl border px-4 text-sm outline-none placeholder:text-white/35"
              style={{
                borderColor: "var(--site-border, rgba(255,255,255,0.12))",
                background: "var(--site-surface-strong, rgba(255,255,255,0.04))",
                color: "var(--site-text, #f8fafc)"
              }}
            />
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
              type="email"
              className="h-11 rounded-2xl border px-4 text-sm outline-none placeholder:text-white/35"
              style={{
                borderColor: "var(--site-border, rgba(255,255,255,0.12))",
                background: "var(--site-surface-strong, rgba(255,255,255,0.04))",
                color: "var(--site-text, #f8fafc)"
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Phone"
              type="tel"
              className="h-11 rounded-2xl border px-4 text-sm outline-none placeholder:text-white/35"
              style={{
                borderColor: "var(--site-border, rgba(255,255,255,0.12))",
                background: "var(--site-surface-strong, rgba(255,255,255,0.04))",
                color: "var(--site-text, #f8fafc)"
              }}
            />
            <input
              value={form.partySize}
              onChange={(event) => setForm((current) => ({ ...current, partySize: event.target.value }))}
              placeholder="Party size"
              inputMode="numeric"
              className="h-11 rounded-2xl border px-4 text-sm outline-none placeholder:text-white/35"
              style={{
                borderColor: "var(--site-border, rgba(255,255,255,0.12))",
                background: "var(--site-surface-strong, rgba(255,255,255,0.04))",
                color: "var(--site-text, #f8fafc)"
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              type="date"
              required
              className="h-11 rounded-2xl border px-4 outline-none"
              style={{
                borderColor: "var(--site-border, rgba(255,255,255,0.12))",
                background: "var(--site-surface-strong, rgba(255,255,255,0.04))",
                color: "var(--site-text, #f8fafc)"
              }}
            />
            <input
              value={form.time}
              onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
              type="time"
              required
              className="h-11 rounded-2xl border px-4 outline-none"
              style={{
                borderColor: "var(--site-border, rgba(255,255,255,0.12))",
                background: "var(--site-surface-strong, rgba(255,255,255,0.04))",
                color: "var(--site-text, #f8fafc)"
              }}
            />
          </div>

          <textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            rows={4}
            placeholder="Notes (optional)"
            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none placeholder:text-white/35"
            style={{
              borderColor: "var(--site-border, rgba(255,255,255,0.12))",
              background: "var(--site-surface-strong, rgba(255,255,255,0.04))",
              color: "var(--site-text, #f8fafc)"
            }}
          />

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition hover:brightness-105 disabled:opacity-60"
            style={{
              background: "var(--site-accent, #ffd34d)",
              color: "var(--site-primary-foreground, #111113)"
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              submitLabel
            )}
          </button>
        </form>
      </Dialog>
    </>
  );
}
