"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

export type ReservationItem = {
  id: string;
  conversation_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  party_size: number | null;
  datetime: string;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
};

const pad = (value: number) => value.toString().padStart(2, "0");

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const statusVariant: Record<ReservationItem["status"], "default" | "success" | "warning" | "info"> = {
  pending: "warning",
  confirmed: "success",
  cancelled: "default"
};

export function ReservationsPanel({ initialReservations }: { initialReservations: ReservationItem[] }) {
  const { push } = useToast();
  const [reservations, setReservations] = useState(initialReservations);
  const [statusFilter, setStatusFilter] = useState<"all" | ReservationItem["status"]>("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return reservations;
    return reservations.filter((reservation) => reservation.status === statusFilter);
  }, [reservations, statusFilter]);

  const updateStatus = async (id: string, status: ReservationItem["status"]) => {
    setSavingId(id);
    const previous = reservations;
    setReservations((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));

    const res = await fetch("/api/reservations/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId: id, status })
    });
    const payload = await res.json().catch(() => null);

    setSavingId(null);

    if (!res.ok || !payload) {
      setReservations(previous);
      push({
        title: "Update failed",
        message: payload?.error ?? "Unable to update reservation.",
        variant: "error"
      });
      return;
    }

    push({ title: "Reservation updated", message: `Status set to ${status}.`, variant: "success" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Recent reservations</p>
          <p className="text-xs text-white/60">{reservations.length} total</p>
        </div>
        <label className="text-xs text-white/60">
          Filter by status
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | ReservationItem["status"])}
            className="mt-2"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </label>
      </div>

      <div className="space-y-3">
        {filtered.map((reservation) => (
          <div
            key={reservation.id}
            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-neutral-950/60 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{reservation.customer_name}</p>
                <p className="text-xs text-white/60">
                  {reservation.customer_phone}
                  {reservation.customer_email ? ` • ${reservation.customer_email}` : ""}
                  {reservation.party_size ? ` • Party of ${reservation.party_size}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={statusVariant[reservation.status]} className="capitalize">
                  {reservation.status}
                </Badge>
                <p className="text-xs text-white/50">{formatDateTime(reservation.datetime)}</p>
              </div>
            </div>

            {reservation.notes ? (
              <p className="text-xs text-white/60">Notes: {reservation.notes}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={savingId === reservation.id || reservation.status === "confirmed"}
                onClick={() => updateStatus(reservation.id, "confirmed")}
              >
                Confirm
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={savingId === reservation.id || reservation.status === "cancelled"}
                onClick={() => updateStatus(reservation.id, "cancelled")}
              >
                Cancel
              </Button>
              <Link
                href={
                  reservation.conversation_id
                    ? `/dashboard/conversations/${reservation.conversation_id}`
                    : "/dashboard/conversations"
                }
                className="text-xs font-semibold text-[#00A3FF]"
              >
                View conversation →
              </Link>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <p className="text-sm text-white/60">No reservations match this filter yet.</p>
        ) : null}
      </div>
    </div>
  );
}
