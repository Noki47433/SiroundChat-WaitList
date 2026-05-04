"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type ReservationStatus = "pending" | "confirmed" | "completed" | "canceled" | "seated" | "no_show";
type ReservationSource = "website" | "whatsapp" | "manual";

type ReservationRow = {
  id: string;
  source: ReservationSource;
  source_conversation_id: string | null;
  start_at: string;
  end_at: string;
  party_size: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  special_request: string | null;
  status: ReservationStatus;
  created_by: string;
  created_at: string;
};

type OpsResponse = {
  reservations: ReservationRow[];
  summary: {
    pending: number;
    confirmed: number;
    completed: number;
    canceled: number;
  };
  settings: {
    restaurantId: string;
    totalCapacity: number;
    timezone: string;
    slotIntervalMin: number;
    defaultDurationMin: number;
  };
};

type SettingsForm = {
  total_capacity: string;
  slot_interval_min: string;
  default_duration_min: string;
  lead_time_min: string;
  max_days_ahead: string;
  buffer_before_min: string;
  buffer_after_min: string;
};

const STATUS_CARDS: Array<{ key: "pending" | "confirmed" | "completed" | "canceled"; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "canceled", label: "Cancelled" }
];

const statusVariant: Record<ReservationStatus, "warning" | "success" | "default" | "info"> = {
  pending: "warning",
  confirmed: "success",
  completed: "default",
  canceled: "default",
  seated: "info",
  no_show: "warning"
};

const sourceLabel: Record<ReservationSource, string> = {
  website: "Website",
  whatsapp: "WhatsApp",
  manual: "Manual"
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export function ReservationsOpsDashboard({ initialReservationId }: { initialReservationId?: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"pending" | "confirmed" | "completed" | "canceled" | "all">(
    "pending"
  );
  const [source, setSource] = useState<"all" | ReservationSource>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partySize, setPartySize] = useState("");
  const [data, setData] = useState<OpsResponse | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<ReservationRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    total_capacity: "",
    slot_interval_min: "",
    default_duration_min: "",
    lead_time_min: "",
    max_days_ahead: "",
    buffer_before_min: "",
    buffer_after_min: ""
  });

  const loadSettingsSnapshot = async () => {
    const response = await fetch("/api/reservations/settings", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error ?? "Failed to load reservation settings");
    }

    setSettingsForm({
      total_capacity: String(payload.totalCapacity ?? ""),
      slot_interval_min: String(payload.settings?.slot_interval_min ?? ""),
      default_duration_min: String(payload.settings?.default_duration_min ?? ""),
      lead_time_min: String(payload.settings?.lead_time_min ?? ""),
      max_days_ahead: String(payload.settings?.max_days_ahead ?? ""),
      buffer_before_min: String(payload.settings?.buffer_before_min ?? ""),
      buffer_after_min: String(payload.settings?.buffer_after_min ?? "")
    });
  };

  const loadReservations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", selectedStatus);
      params.set("source", source);
      if (search.trim()) params.set("q", search.trim());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (partySize) params.set("partySize", partySize);

      const response = await fetch(`/api/reservations/ops?${params.toString()}`, {
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load reservations");
      }

      const typed = payload as OpsResponse;
      setData(typed);

      if (initialReservationId && !selectedReservation) {
        const match = typed.reservations.find((reservation) => reservation.id === initialReservationId);
        if (match) {
          setSelectedReservation(match);
          setDetailOpen(true);
        }
      } else if (selectedReservation) {
        const next = typed.reservations.find((reservation) => reservation.id === selectedReservation.id) ?? null;
        setSelectedReservation(next);
      }
    } catch (error) {
      push({
        title: "Load failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadReservations();
    }, 200);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, source, search, dateFrom, dateTo, partySize]);

  const reservations = data?.reservations ?? [];
  const summary = data?.summary ?? { pending: 0, confirmed: 0, completed: 0, canceled: 0 };

  const summaryCards = {
    pending: summary.pending ?? 0,
    confirmed: summary.confirmed ?? 0,
    completed: summary.completed ?? 0,
    canceled: summary.canceled ?? 0
  };

  const updateReservationStatus = async (reservationId: string, status: ReservationStatus) => {
    setSavingStatus(`${reservationId}:${status}`);
    try {
      const response = await fetch(`/api/reservations/${reservationId}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update reservation");
      }

      await loadReservations();
      if (selectedReservation?.id === reservationId && payload?.reservation) {
        setSelectedReservation(payload.reservation as ReservationRow);
      }
    } catch (error) {
      push({
        title: "Status update failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
    } finally {
      setSavingStatus(null);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await fetch("/api/reservations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_capacity: Number(settingsForm.total_capacity),
          slot_interval_min: Number(settingsForm.slot_interval_min),
          default_duration_min: Number(settingsForm.default_duration_min),
          lead_time_min: Number(settingsForm.lead_time_min),
          max_days_ahead: Number(settingsForm.max_days_ahead),
          buffer_before_min: Number(settingsForm.buffer_before_min),
          buffer_after_min: Number(settingsForm.buffer_after_min)
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to save settings");
      }

      setSettingsOpen(false);
      await loadReservations();
    } catch (error) {
      push({
        title: "Settings save failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const openSettings = async () => {
    try {
      await loadSettingsSnapshot();
      setSettingsOpen(true);
    } catch (error) {
      push({
        title: "Settings load failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Reservations</p>
          <h2 className="dashboard-heading mt-2 text-3xl font-semibold text-white">Reservation operations</h2>
          <p className="mt-2 text-sm text-white/60">
            Manage reservation requests from your website, WhatsApp, and AI assistant.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void openSettings()}>
            Reservation settings
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUS_CARDS.map((item) => {
          const active = selectedStatus === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedStatus(item.key)}
              className={`dashboard-surface rounded-3xl border p-5 text-left transition ${
                active ? "border-[#ffd87266] bg-[#ffd87214]" : "border-white/10 bg-white/[0.03] hover:border-white/20"
              }`}
            >
              <p className="text-sm text-white/60">{item.label}</p>
              <p className="dashboard-heading mt-3 text-3xl font-semibold text-white">
                {summaryCards[item.key]}
              </p>
            </button>
          );
        })}
      </div>

      <Card className="dashboard-surface space-y-4">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))_auto]">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or phone" />
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <Select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as typeof selectedStatus)}>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="canceled">Cancelled</option>
            <option value="all">All statuses</option>
          </Select>
          <Select value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
            <option value="all">All sources</option>
            <option value="website">Website</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="manual">Manual</option>
          </Select>
          <div className="flex gap-2">
            <Input
              value={partySize}
              onChange={(event) => setPartySize(event.target.value)}
              placeholder="Guests"
              className="w-full xl:w-[110px]"
            />
            <Button
              variant="outline"
              onClick={() => {
                setSelectedStatus("pending");
                setSource("all");
                setSearch("");
                setDateFrom("");
                setDateTo("");
                setPartySize("");
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
            <p className="text-lg font-semibold text-white">No reservations found.</p>
            <p className="mt-2 text-sm text-white/55">
              Try another status or date range, or wait for new reservation requests to arrive.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-white/10">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-white/45">
                <tr>
                  <th className="px-4 py-3">No.</th>
                  <th className="px-4 py-3">Date & time</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Guests</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation, index) => (
                  <tr
                    key={reservation.id}
                    className="border-t border-white/10 bg-white/[0.02] transition hover:bg-white/[0.05]"
                  >
                    <td className="px-4 py-4 text-white/70">{index + 1}.</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-white">{formatDateTime(reservation.start_at)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReservation(reservation);
                          setDetailOpen(true);
                        }}
                        className="font-semibold text-white transition hover:text-[#ffe08a]"
                      >
                        {reservation.customer_name}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-white/70">{reservation.customer_phone || "—"}</td>
                    <td className="px-4 py-4 text-white/70">{reservation.party_size}</td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={reservation.source === "whatsapp" ? "success" : reservation.source === "manual" ? "warning" : "info"}
                      >
                        {sourceLabel[reservation.source]}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={statusVariant[reservation.status]} className="capitalize">
                        {reservation.status === "canceled" ? "cancelled" : reservation.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-white/60">{formatDateTime(reservation.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {reservation.status === "pending" ? (
                          <>
                            <Button
                              size="xs"
                              onClick={() => void updateReservationStatus(reservation.id, "confirmed")}
                              disabled={savingStatus === `${reservation.id}:confirmed`}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => void updateReservationStatus(reservation.id, "canceled")}
                              disabled={savingStatus === `${reservation.id}:canceled`}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}

                        {reservation.status === "confirmed" ? (
                          <>
                            <Button
                              size="xs"
                              onClick={() => void updateReservationStatus(reservation.id, "completed")}
                              disabled={savingStatus === `${reservation.id}:completed`}
                            >
                              Mark completed
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => void updateReservationStatus(reservation.id, "canceled")}
                              disabled={savingStatus === `${reservation.id}:canceled`}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}

                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => {
                            setSelectedReservation(reservation);
                            setDetailOpen(true);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent>
          {selectedReservation ? (
            <div className="space-y-5">
              <SheetHeader>
                <SheetTitle>{selectedReservation.customer_name}</SheetTitle>
                <SheetDescription>Reservation details and restaurant actions.</SheetDescription>
              </SheetHeader>

              <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Status</span>
                  <Badge variant={statusVariant[selectedReservation.status]} className="capitalize">
                    {selectedReservation.status === "canceled" ? "cancelled" : selectedReservation.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Source</span>
                  <Badge
                    variant={
                      selectedReservation.source === "whatsapp"
                        ? "success"
                        : selectedReservation.source === "manual"
                          ? "warning"
                          : "info"
                    }
                  >
                    {sourceLabel[selectedReservation.source]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Date & time</span>
                  <span className="text-sm text-white">{formatDateTime(selectedReservation.start_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Guests</span>
                  <span className="text-sm text-white">{selectedReservation.party_size}</span>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">
                <p>Phone: {selectedReservation.customer_phone || "—"}</p>
                <p className="mt-2">Email: {selectedReservation.customer_email || "—"}</p>
                <p className="mt-2">
                  Special request: {selectedReservation.special_request || selectedReservation.notes || "—"}
                </p>
                <p className="mt-2">Created at: {formatDateTime(selectedReservation.created_at)}</p>
              </div>

              <div className="grid gap-2">
                {selectedReservation.status === "pending" ? (
                  <>
                    <Button onClick={() => void updateReservationStatus(selectedReservation.id, "confirmed")}>
                      Confirm
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void updateReservationStatus(selectedReservation.id, "canceled")}
                    >
                      Cancel
                    </Button>
                  </>
                ) : null}

                {selectedReservation.status === "confirmed" ? (
                  <>
                    <Button onClick={() => void updateReservationStatus(selectedReservation.id, "completed")}>
                      Mark completed
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void updateReservationStatus(selectedReservation.id, "canceled")}
                    >
                      Cancel
                    </Button>
                  </>
                ) : null}

                {selectedReservation.source === "whatsapp" && selectedReservation.source_conversation_id ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      router.push(`/dashboard/inbox?conversation=${selectedReservation.source_conversation_id}`)
                    }
                  >
                    Open WhatsApp conversation
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Reservation settings"
        footer={
          <>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveSettings()} disabled={savingSettings}>
              {savingSettings ? "Saving..." : "Save settings"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={settingsForm.total_capacity}
            onChange={(event) => setSettingsForm((current) => ({ ...current, total_capacity: event.target.value }))}
            placeholder="Total capacity"
          />
          <Input
            value={settingsForm.slot_interval_min}
            onChange={(event) => setSettingsForm((current) => ({ ...current, slot_interval_min: event.target.value }))}
            placeholder="Slot interval (minutes)"
          />
          <Input
            value={settingsForm.default_duration_min}
            onChange={(event) =>
              setSettingsForm((current) => ({ ...current, default_duration_min: event.target.value }))
            }
            placeholder="Average table duration"
          />
          <Input
            value={settingsForm.lead_time_min}
            onChange={(event) => setSettingsForm((current) => ({ ...current, lead_time_min: event.target.value }))}
            placeholder="Lead time (minutes)"
          />
          <Input
            value={settingsForm.max_days_ahead}
            onChange={(event) => setSettingsForm((current) => ({ ...current, max_days_ahead: event.target.value }))}
            placeholder="Max days ahead"
          />
          <Input
            value={settingsForm.buffer_before_min}
            onChange={(event) =>
              setSettingsForm((current) => ({ ...current, buffer_before_min: event.target.value }))
            }
            placeholder="Buffer before"
          />
          <Input
            value={settingsForm.buffer_after_min}
            onChange={(event) =>
              setSettingsForm((current) => ({ ...current, buffer_after_min: event.target.value }))
            }
            placeholder="Buffer after"
          />
        </div>
      </Modal>
    </div>
  );
}
