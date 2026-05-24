"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AddReservationDialog,
  type ManualReservationRecord,
  type ManualReservationValues
} from "@/components/reservations/AddReservationDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ACTION_TYPE_META, type ActionType } from "@/lib/config/industry-presets";

type ReservationStatus = "pending" | "confirmed" | "completed" | "canceled" | "seated" | "no_show";
type ReservationSource = "website" | "whatsapp" | "instagram" | "manual";
type ReservationRow = ManualReservationRecord;

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
  instagram: "Instagram",
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

function SettingsField({
  label,
  hint,
  value,
  onChange,
  min,
  step = 1
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-xs leading-5 text-white/55">{hint}</p>
      </div>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ReservationsOpsDashboard({
  initialReservationId,
  actionType = "restaurant_reservation",
}: {
  initialReservationId?: string;
  actionType?: ActionType;
}) {
  const meta = ACTION_TYPE_META[actionType] ?? ACTION_TYPE_META.restaurant_reservation;
  const router = useRouter();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [addReservationOpen, setAddReservationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionSettingsOpen, setActionSettingsOpen] = useState(false);
  const [savingActionSettings, setSavingActionSettings] = useState(false);
  const [actionSettingsForm, setActionSettingsForm] = useState({
    capacity: "1",
    slot_duration_min: "60",
    slot_interval_min: "30",
    avg_price_eur: "",
    max_days_ahead: "30",
    lead_time_min: "60",
    notes: "",
  });
  const [focusReservationId, setFocusReservationId] = useState<string | null>(initialReservationId ?? null);
  const [refreshNonce, setRefreshNonce] = useState(0);
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

  const loadActionSettings = async () => {
    const response = await fetch(`/api/action-settings?actionType=${actionType}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? "Failed to load settings");
    const s = payload.settings;
    setActionSettingsForm({
      capacity: String(s.capacity ?? 1),
      slot_duration_min: String(s.slot_duration_min ?? 60),
      slot_interval_min: String(s.slot_interval_min ?? 30),
      avg_price_eur: s.avg_price_eur != null ? String(s.avg_price_eur) : "",
      max_days_ahead: String(s.max_days_ahead ?? 30),
      lead_time_min: String(s.lead_time_min ?? 60),
      notes: s.notes ?? "",
    });
  };

  const saveActionSettings = async () => {
    setSavingActionSettings(true);
    try {
      const response = await fetch("/api/action-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          capacity: Number(actionSettingsForm.capacity),
          slot_duration_min: Number(actionSettingsForm.slot_duration_min),
          slot_interval_min: Number(actionSettingsForm.slot_interval_min),
          avg_price_eur: actionSettingsForm.avg_price_eur ? Number(actionSettingsForm.avg_price_eur) : null,
          max_days_ahead: Number(actionSettingsForm.max_days_ahead),
          lead_time_min: Number(actionSettingsForm.lead_time_min),
          notes: actionSettingsForm.notes || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Failed to save settings");
      setActionSettingsOpen(false);
      push({ title: "Settings saved", message: "Action settings updated.", variant: "success" });
    } catch (error) {
      push({
        title: "Save failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setSavingActionSettings(false);
    }
  };

  const openActionSettings = async () => {
    try {
      await loadActionSettings();
      setActionSettingsOpen(true);
    } catch (error) {
      push({ title: "Load failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    }
  };

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
      params.set("actionType", actionType);
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

      if (focusReservationId) {
        const match = typed.reservations.find((reservation) => reservation.id === focusReservationId);
        if (match) {
          setSelectedReservation(match);
          setDetailOpen(true);
          setFocusReservationId(null);
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
  }, [selectedStatus, source, search, dateFrom, dateTo, partySize, refreshNonce]);

  const reservations = data?.reservations ?? [];
  const summary = data?.summary ?? { pending: 0, confirmed: 0, completed: 0, canceled: 0 };
  const hasActiveFilters = Boolean(
    search.trim() || dateFrom || dateTo || partySize || source !== "all" || selectedStatus !== "pending"
  );

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
    const parsedValues = {
      total_capacity: Number(settingsForm.total_capacity),
      slot_interval_min: Number(settingsForm.slot_interval_min),
      default_duration_min: Number(settingsForm.default_duration_min),
      lead_time_min: Number(settingsForm.lead_time_min),
      max_days_ahead: Number(settingsForm.max_days_ahead),
      buffer_before_min: Number(settingsForm.buffer_before_min),
      buffer_after_min: Number(settingsForm.buffer_after_min)
    };

    if (
      !Number.isFinite(parsedValues.total_capacity) ||
      parsedValues.total_capacity <= 0 ||
      !Number.isFinite(parsedValues.slot_interval_min) ||
      parsedValues.slot_interval_min <= 0 ||
      !Number.isFinite(parsedValues.default_duration_min) ||
      parsedValues.default_duration_min <= 0 ||
      !Number.isFinite(parsedValues.max_days_ahead) ||
      parsedValues.max_days_ahead <= 0 ||
      !Number.isFinite(parsedValues.lead_time_min) ||
      parsedValues.lead_time_min < 0 ||
      !Number.isFinite(parsedValues.buffer_before_min) ||
      parsedValues.buffer_before_min < 0 ||
      !Number.isFinite(parsedValues.buffer_after_min) ||
      parsedValues.buffer_after_min < 0
    ) {
      push({
        title: "Check your settings",
        message:
          "Capacity, slot interval, duration, and max days ahead must be greater than zero. Notice and buffer values cannot be negative.",
        variant: "error"
      });
      return;
    }

    setSavingSettings(true);
    try {
      const response = await fetch("/api/reservations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedValues)
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

  const handleReservationCreated = (reservation: ManualReservationRecord, values: ManualReservationValues) => {
    setFocusReservationId(reservation.id);
    setSelectedReservation(null);
    setSelectedStatus("confirmed");
    setSource("manual");
    setSearch("");
    setDateFrom(values.date);
    setDateTo(values.date);
    setPartySize("");
    setRefreshNonce((current) => current + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">{meta.navLabel}</p>
          <h2 className="dashboard-heading mt-2 text-3xl font-semibold text-white">{meta.pageTitle}</h2>
          <p className="mt-2 text-sm text-white/60">{meta.pageSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setAddReservationOpen(true)}
            className="rounded-2xl bg-[#ffd24a] text-neutral-950 shadow-[0_18px_48px_rgba(255,210,74,0.18)] hover:bg-[#ffdc76]"
          >
            <Plus className="mr-2 h-4 w-4" />
            {meta.addButtonLabel}
          </Button>
          {actionType === "restaurant_reservation" ? (
            <Button variant="secondary" onClick={() => void openSettings()}>
              Reservation settings
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => void openActionSettings()}>
              {meta.navLabel.replace(/s$/, "")} settings
            </Button>
          )}
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
            <option value="instagram">Instagram</option>
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
            <p className="text-lg font-semibold text-white">
              {hasActiveFilters ? `No ${meta.navLabel.toLowerCase()} match these filters.` : meta.emptyStateTitle}
            </p>
            <p className="mt-2 text-sm text-white/55">
              {hasActiveFilters
                ? "Try another status or date range, or add a record manually."
                : meta.emptyStateSub}
            </p>
            <div className="mt-5 flex justify-center">
              <Button
                onClick={() => setAddReservationOpen(true)}
                className="rounded-2xl bg-[#ffd24a] text-neutral-950 hover:bg-[#ffdc76]"
              >
                <Plus className="mr-2 h-4 w-4" />
                {meta.addButtonLabel}
              </Button>
            </div>
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
                  {meta.showPartySize ? <th className="px-4 py-3">Guests</th> : null}
                  <th className="px-4 py-3">Notes</th>
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
                    {meta.showPartySize ? (
                      <td className="px-4 py-4 text-white/70">{reservation.party_size ?? "—"}</td>
                    ) : null}
                    <td className="max-w-[200px] truncate px-4 py-4 text-white/60 text-xs">
                      {reservation.notes || reservation.special_request || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={
                          reservation.source === "whatsapp"
                            ? "success"
                            : reservation.source === "instagram"
                              ? "warning"
                              : reservation.source === "manual"
                                ? "warning"
                                : "info"
                        }
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
                <SheetDescription>{meta.navLabel.replace(/s$/, "")} details and actions.</SheetDescription>
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
                          : selectedReservation.source === "instagram"
                            ? "warning"
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
                {meta.showPartySize ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Guests</span>
                    <span className="text-sm text-white">{selectedReservation.party_size ?? "—"}</span>
                  </div>
                ) : null}
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
                      router.push(
                        `/dashboard/channels?tab=inbox&conversation=${selectedReservation.source_conversation_id}`
                      )
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
        size="lg"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveSettings()} disabled={savingSettings}>
              {savingSettings ? "Saving..." : "Save settings"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
            These settings help SiroundChat decide when reservations should be accepted or marked as unavailable.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SettingsField
              label="Total seats / capacity (guests)"
              hint="Maximum number of guests your restaurant can handle at the same time."
              value={settingsForm.total_capacity}
              min={1}
              onChange={(value) => setSettingsForm((current) => ({ ...current, total_capacity: value }))}
            />
            <SettingsField
              label="Reservation slot interval (minutes)"
              hint="How often customers can book. Example: every 30 minutes."
              value={settingsForm.slot_interval_min}
              min={1}
              onChange={(value) => setSettingsForm((current) => ({ ...current, slot_interval_min: value }))}
            />
            <SettingsField
              label="Average table duration (minutes)"
              hint="How long a typical reservation blocks capacity. Example: 90 minutes."
              value={settingsForm.default_duration_min}
              min={1}
              onChange={(value) => setSettingsForm((current) => ({ ...current, default_duration_min: value }))}
            />
            <SettingsField
              label="Minimum notice before booking (minutes)"
              hint="How soon before the reservation time customers are allowed to book."
              value={settingsForm.lead_time_min}
              min={0}
              onChange={(value) => setSettingsForm((current) => ({ ...current, lead_time_min: value }))}
            />
            <SettingsField
              label="Max days in advance"
              hint="How far into the future customers can request a reservation."
              value={settingsForm.max_days_ahead}
              min={1}
              onChange={(value) => setSettingsForm((current) => ({ ...current, max_days_ahead: value }))}
            />
            <SettingsField
              label="Buffer before reservation (minutes)"
              hint="Extra preparation time to protect before each reservation starts."
              value={settingsForm.buffer_before_min}
              min={0}
              onChange={(value) => setSettingsForm((current) => ({ ...current, buffer_before_min: value }))}
            />
            <SettingsField
              label="Buffer after reservation (minutes)"
              hint="Extra cleanup or reset time to keep after each reservation ends."
              value={settingsForm.buffer_after_min}
              min={0}
              onChange={(value) => setSettingsForm((current) => ({ ...current, buffer_after_min: value }))}
            />
          </div>
        </div>
      </Modal>

      <AddReservationDialog
        open={addReservationOpen}
        onOpenChange={setAddReservationOpen}
        timeZone={data?.settings.timezone ?? "Europe/Belgrade"}
        slotIntervalMin={data?.settings.slotIntervalMin ?? 15}
        onCreated={handleReservationCreated}
      />

      <Modal
        open={actionSettingsOpen}
        onClose={() => setActionSettingsOpen(false)}
        title={`${meta.navLabel.replace(/s$/, "")} settings`}
        footer={
          <>
            <Button variant="outline" onClick={() => setActionSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveActionSettings()} disabled={savingActionSettings}>
              {savingActionSettings ? "Saving..." : "Save settings"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.15em] text-white/50">Capacity (concurrent slots)</label>
              <Input
                type="number"
                min="1"
                max="500"
                value={actionSettingsForm.capacity}
                onChange={(e) => setActionSettingsForm((c) => ({ ...c, capacity: e.target.value }))}
                placeholder="e.g. 2 (barber chairs)"
              />
              <p className="text-xs text-white/40">How many customers can be served simultaneously</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.15em] text-white/50">Avg. service duration (min)</label>
              <Input
                type="number"
                min="5"
                max="480"
                value={actionSettingsForm.slot_duration_min}
                onChange={(e) => setActionSettingsForm((c) => ({ ...c, slot_duration_min: e.target.value }))}
                placeholder="e.g. 45"
              />
              <p className="text-xs text-white/40">Typical time per appointment</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.15em] text-white/50">Avg. price (€)</label>
              <Input
                type="number"
                min="0"
                value={actionSettingsForm.avg_price_eur}
                onChange={(e) => setActionSettingsForm((c) => ({ ...c, avg_price_eur: e.target.value }))}
                placeholder="e.g. 25"
              />
              <p className="text-xs text-white/40">Used to estimate monthly revenue in reports</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.15em] text-white/50">Booking window (days)</label>
              <Input
                type="number"
                min="1"
                max="365"
                value={actionSettingsForm.max_days_ahead}
                onChange={(e) => setActionSettingsForm((c) => ({ ...c, max_days_ahead: e.target.value }))}
                placeholder="e.g. 30"
              />
              <p className="text-xs text-white/40">How far ahead customers can book</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.15em] text-white/50">Min. notice (minutes)</label>
              <Input
                type="number"
                min="0"
                value={actionSettingsForm.lead_time_min}
                onChange={(e) => setActionSettingsForm((c) => ({ ...c, lead_time_min: e.target.value }))}
                placeholder="e.g. 60"
              />
              <p className="text-xs text-white/40">Minimum notice before a booking</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.15em] text-white/50">Slot interval (min)</label>
              <Input
                type="number"
                min="5"
                max="240"
                value={actionSettingsForm.slot_interval_min}
                onChange={(e) => setActionSettingsForm((c) => ({ ...c, slot_interval_min: e.target.value }))}
                placeholder="e.g. 30"
              />
              <p className="text-xs text-white/40">Gap between available slots</p>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.15em] text-white/50">Notes for the AI (optional)</label>
            <Input
              value={actionSettingsForm.notes}
              onChange={(e) => setActionSettingsForm((c) => ({ ...c, notes: e.target.value }))}
              placeholder="e.g. We only do walk-in on Saturdays, no Sunday bookings"
            />
            <p className="text-xs text-white/40">Extra context the chatbot will use when guiding customers</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
