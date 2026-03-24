"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { ReservationRecord } from "@/lib/reservations/types";

const statusVariant: Record<ReservationRecord["status"], "default" | "success" | "warning" | "info"> = {
  pending: "warning",
  confirmed: "success",
  seated: "info",
  completed: "default",
  canceled: "default",
  no_show: "warning"
};

const toDateInput = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInput = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
};

const buildTimeOptions = (intervalMin: number) => {
  const options: string[] = [];
  const safeInterval = Math.max(5, intervalMin);
  for (let minuteOfDay = 0; minuteOfDay < 24 * 60; minuteOfDay += safeInterval) {
    const hours = Math.floor(minuteOfDay / 60)
      .toString()
      .padStart(2, "0");
    const minutes = (minuteOfDay % 60).toString().padStart(2, "0");
    options.push(`${hours}:${minutes}`);
  }
  return options;
};

const toIsoFromDateTime = (date: string, time: string) => {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const formatSlotTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
};

type AvailabilitySlot = {
  startAtISO: string;
  endAtISO: string;
  available: boolean;
  remainingCapacity: number;
};

export function ReservationDrawer({
  open,
  reservation,
  restaurantId,
  intervalMin,
  defaultDurationMin,
  onOpenChange,
  onUpdated
}: {
  open: boolean;
  reservation: ReservationRecord | null;
  restaurantId: string;
  intervalMin: number;
  defaultDurationMin: number;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const { push } = useToast();
  const [partySize, setPartySize] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMin, setDurationMin] = useState(defaultDurationMin);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    if (!reservation) return;
    setPartySize(Math.max(1, reservation.party_size || 1));
    setStartDate(toDateInput(reservation.start_at));
    setStartTime(toTimeInput(reservation.start_at));
    const start = new Date(reservation.start_at);
    const end = new Date(reservation.end_at);
    const computedDuration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000));
    setDurationMin(Number.isFinite(computedDuration) ? computedDuration : defaultDurationMin);
    setNotes(reservation.notes ?? "");
    setInlineError(null);
    setMoveOpen(false);
    setMoveDate(toDateInput(reservation.start_at));
    setSlots([]);
  }, [defaultDurationMin, reservation]);

  const timeOptions = useMemo(() => buildTimeOptions(intervalMin), [intervalMin]);

  const patchReservation = async (payload: Record<string, unknown>, successMessage: string) => {
    if (!reservation) return false;

    setSaving(true);
    setInlineError(null);

    const response = await fetch(`/api/reservations/${reservation.id}/update`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      const message = body?.error ?? "Unable to save reservation.";
      if (body?.code === "capacity_conflict") {
        setInlineError("Not enough capacity at that time.");
      } else {
        setInlineError(message);
      }
      push({ title: "Reservation update failed", message, variant: "error" });
      return false;
    }

    push({ title: "Reservation updated", message: successMessage, variant: "success" });
    onUpdated();
    return true;
  };

  const handleSave = async () => {
    if (!reservation) return;
    const startAtISO = toIsoFromDateTime(startDate, startTime);
    if (!startAtISO) {
      setInlineError("Select a valid date and time.");
      return;
    }

    await patchReservation(
      {
        party_size: partySize,
        start_at: startAtISO,
        duration_min: durationMin,
        notes
      },
      "Changes saved"
    );
  };

  const handleStatus = async (status: ReservationRecord["status"]) => {
    await patchReservation({ status }, `Status set to ${status}`);
  };

  const handleCancel = async () => {
    const success = await patchReservation({ status: "canceled" }, "Reservation canceled");
    if (success) {
      setShowCancelConfirm(false);
      onOpenChange(false);
    }
  };

  const fetchSlots = async () => {
    if (!moveDate) return;
    setLoadingSlots(true);
    const params = new URLSearchParams({
      restaurantId,
      date: moveDate,
      partySize: String(partySize),
      durationMin: String(durationMin)
    });

    const response = await fetch(`/api/reservations/availability?${params.toString()}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    setLoadingSlots(false);

    if (!response.ok) {
      setInlineError(body?.error ?? "Unable to load available slots.");
      return;
    }

    const availableSlots = ((body?.slots ?? []) as AvailabilitySlot[]).filter((slot) => slot.available);
    setSlots(availableSlots);
  };

  const handleMoveToSlot = async (slot: AvailabilitySlot) => {
    const success = await patchReservation(
      {
        start_at: slot.startAtISO,
        duration_min: durationMin,
        party_size: partySize
      },
      "Reservation moved"
    );

    if (success) {
      setMoveOpen(false);
      setSlots([]);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          {reservation ? (
            <div className="space-y-5">
              <SheetHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle>{reservation.customer_name}</SheetTitle>
                    <SheetDescription>Update reservation details and status.</SheetDescription>
                  </div>
                  <Badge variant={statusVariant[reservation.status]} className="capitalize">
                    {reservation.status}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white/75">Phone</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{reservation.customer_phone || "-"}</p>
                    {reservation.customer_phone ? (
                      <CopyButton value={reservation.customer_phone} size="xs" variant="secondary" />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">Party Size</p>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setPartySize((prev) => Math.max(1, prev - 1))}
                    >
                      -
                    </Button>
                    <span className="w-10 text-center text-sm font-semibold">{partySize}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setPartySize((prev) => Math.max(1, prev + 1))}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-white/45">Date</span>
                    <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-white/45">Start time</span>
                    <Select value={startTime} onChange={(event) => setStartTime(event.target.value)}>
                      {timeOptions.map((timeValue) => (
                        <option key={timeValue} value={timeValue}>
                          {timeValue}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-white/45">Duration</span>
                  <Select value={String(durationMin)} onChange={(event) => setDurationMin(Number(event.target.value) || 90)}>
                    {[60, 75, 90, 120].map((value) => (
                      <option key={value} value={value}>
                        {value} min
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-white/45">Notes</span>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
                </label>
              </div>

              {inlineError ? <p className="text-sm text-red-300">{inlineError}</p> : null}

              <div className="grid gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>

                <Button type="button" variant="secondary" onClick={() => setMoveOpen((prev) => !prev)} disabled={saving}>
                  {moveOpen ? "Close move" : "Move"}
                </Button>

                {moveOpen ? (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-sm font-medium">Select new time</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input type="date" value={moveDate} onChange={(event) => setMoveDate(event.target.value)} />
                      <Button type="button" variant="outline" onClick={fetchSlots} disabled={loadingSlots}>
                        {loadingSlots ? "Loading..." : "Check availability"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((slot) => (
                        <Button
                          key={slot.startAtISO}
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => handleMoveToSlot(slot)}
                          disabled={saving}
                        >
                          {formatSlotTime(slot.startAtISO)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-3 gap-2">
                  <Button type="button" variant="outline" onClick={() => handleStatus("seated")} disabled={saving}>
                    Mark seated
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleStatus("completed")} disabled={saving}>
                    Mark completed
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleStatus("no_show")} disabled={saving}>
                    Mark no_show
                  </Button>
                </div>

                <Button type="button" variant="danger" onClick={() => setShowCancelConfirm(true)} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Modal
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="Cancel reservation?"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setShowCancelConfirm(false)}>
              Keep
            </Button>
            <Button type="button" variant="danger" onClick={handleCancel} disabled={saving}>
              Confirm cancel
            </Button>
          </>
        }
      >
        This will set the reservation status to canceled and keep the record for history.
      </Modal>
    </>
  );
}
