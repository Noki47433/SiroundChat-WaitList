"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { ReservationDrawer } from "@/components/reservations/ReservationDrawer";
import { TimelineGrid } from "@/components/reservations/TimelineGrid";
import type {
  ReservationListResponse,
  ReservationRecord,
  ReservationSettingsResponse
} from "@/lib/reservations/types";

const ACTIVE_STATUS_FOR_CAPACITY = new Set<ReservationRecord["status"]>(["pending", "confirmed", "seated", "completed"]);
const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = (iso: string, timeZone: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
};

const formatDateHeading = (dateKey: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
};

const getTimelineRange = (
  settings: ReservationSettingsResponse | null | undefined,
  includeArchived: boolean
) => {
  const now = new Date();
  const maxDaysAhead = settings?.settings.max_days_ahead ?? 30;
  const autoArchiveAfterHours = settings?.settings.auto_archive_after_hours ?? 72;
  const from = includeArchived
    ? new Date(now.getTime() - 365 * DAY_MS)
    : new Date(now.getTime() - Math.max(24, autoArchiveAfterHours + 12) * 60 * 60 * 1000);
  const to = new Date(now.getTime() + Math.max(1, maxDaysAhead) * DAY_MS);
  return { from: from.toISOString(), to: to.toISOString() };
};

export function ReservationsTimelinePage({ restaurantId }: { restaurantId: string }) {
  const { push } = useToast();

  const settingsRef = useRef<ReservationSettingsResponse | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [settings, setSettings] = useState<ReservationSettingsResponse | null>(null);
  const [listData, setListData] = useState<ReservationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capacityInput, setCapacityInput] = useState("");
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ReservationRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timelineElement, setTimelineElement] = useState<HTMLDivElement | null>(null);

  const loadSettings = useCallback(async () => {
    const response = await fetch(`/api/reservations/settings?restaurantId=${restaurantId}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error ?? "Failed to load reservation settings");
    }
    const typed = body as ReservationSettingsResponse;
    settingsRef.current = typed;
    setSettings(typed);
    setCapacityInput(String(typed.totalCapacity));
    return typed;
  }, [restaurantId]);

  const loadReservations = useCallback(
    async (settingsOverride?: ReservationSettingsResponse | null) => {
      const range = getTimelineRange(settingsOverride ?? settingsRef.current, includeArchived);
      const params = new URLSearchParams({
        restaurantId,
        from: range.from,
        to: range.to,
        includeArchived: String(includeArchived)
      });

      const response = await fetch(`/api/reservations/list?${params.toString()}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to load reservations");
      }

      const typed = body as ReservationListResponse;
      setListData(typed);

      setSelectedReservation((current) => {
        if (!current) return null;
        return typed.reservations.find((reservation) => reservation.id === current.id) ?? null;
      });
    },
    [includeArchived, restaurantId]
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedSettings = await loadSettings();
      await loadReservations(loadedSettings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load reservations");
    } finally {
      setLoading(false);
    }
  }, [loadReservations, loadSettings]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!drawerOpen) {
      setSelectedReservation(null);
    }
  }, [drawerOpen]);

  const currentUsedCapacity = useMemo(() => {
    const reservations = listData?.reservations ?? [];
    const now = Date.now();
    return reservations.reduce((sum, reservation) => {
      if (!ACTIVE_STATUS_FOR_CAPACITY.has(reservation.status)) return sum;
      const start = new Date(reservation.start_at).getTime();
      const end = new Date(reservation.end_at).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) return sum;
      if (now >= start && now <= end) {
        return sum + Math.max(0, Number(reservation.party_size) || 0);
      }
      return sum;
    }, 0);
  }, [listData?.reservations]);

  const totalCapacity = listData?.totalCapacity ?? settings?.totalCapacity ?? 0;
  const timezone = listData?.timezone ?? settings?.timezone ?? "UTC";

  const reservationsByDate = useMemo(() => {
    const byDate = new Map<string, ReservationRecord[]>();
    const reservations = listData?.reservations ?? [];

    for (const reservation of reservations) {
      const dateKey = toDateKey(reservation.start_at, timezone);
      const existing = byDate.get(dateKey) ?? [];
      existing.push(reservation);
      byDate.set(dateKey, existing);
    }

    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateKey, reservations]) => ({
        dateKey,
        reservations: [...reservations].sort((a, b) => {
          const aStart = new Date(a.start_at).getTime();
          const bStart = new Date(b.start_at).getTime();
          return aStart - bStart;
        })
      }));
  }, [listData?.reservations, timezone]);

  const handleReservationClick = (reservation: ReservationRecord) => {
    setSelectedReservation(reservation);
    setDrawerOpen(true);
  };

  const handleNowScroll = () => {
    if (!timelineElement) return;

    const now = new Date();
    const startMinute = 9 * 60;
    const endMinute = 23 * 60;
    const minuteOfDay = now.getHours() * 60 + now.getMinutes();
    const ratio = Math.max(0, Math.min(1, (minuteOfDay - startMinute) / (endMinute - startMinute)));

    const targetLeft = Math.max(0, ratio * timelineElement.scrollWidth - timelineElement.clientWidth / 2);
    timelineElement.scrollTo({ left: targetLeft, behavior: "smooth" });
  };

  const onDrawerUpdated = async () => {
    await loadReservations().catch((loadError) => {
      push({
        title: "Refresh failed",
        message: loadError instanceof Error ? loadError.message : "Failed to refresh timeline",
        variant: "error"
      });
    });
  };

  const handleCapacitySave = async () => {
    const parsed = Number(capacityInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      push({
        title: "Invalid capacity",
        message: "Please enter a number greater than 0.",
        variant: "error"
      });
      return;
    }

    setSavingCapacity(true);
    const response = await fetch(`/api/reservations/settings?restaurantId=${restaurantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, total_capacity: Math.floor(parsed) })
    });
    const body = await response.json().catch(() => null);
    setSavingCapacity(false);

    if (!response.ok) {
      push({
        title: "Capacity update failed",
        message: body?.error ?? "Unable to save total capacity.",
        variant: "error"
      });
      return;
    }

    const typed = body as ReservationSettingsResponse;
    settingsRef.current = typed;
    setSettings(typed);
    setCapacityInput(String(typed.totalCapacity));
    await loadReservations(typed);
    push({
      title: "Capacity updated",
      message: `Total capacity is now ${typed.totalCapacity}.`,
      variant: "success"
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Reservations</p>
        <h2 className="mt-2 text-3xl font-semibold">Timeline</h2>
        <p className="mt-2 text-sm text-white/60">Capacity-based booking with visual table lanes.</p>
      </div>

      <Card className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-1.5">
            <span className="text-xs uppercase tracking-[0.14em] text-white/50">Total capacity</span>
            <Input
              type="number"
              min={1}
              step={1}
              value={capacityInput}
              onChange={(event) => setCapacityInput(event.target.value)}
              className="h-8 w-[96px]"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCapacitySave}
              disabled={savingCapacity}
              data-tutorial-target="reservations-capacity-save"
            >
              {savingCapacity ? "Saving..." : "Save"}
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/80">
            <Switch checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
            Show archived
          </label>

          <p className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75">
            Capacity: <span className="font-semibold text-white">{currentUsedCapacity}</span> / {totalCapacity}
          </p>

          <Button type="button" variant="secondary" size="sm" onClick={handleNowScroll}>
            Now
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={() => void refreshAll()}>
            Refresh
          </Button>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-white/60">Loading timeline...</p>
        ) : (
          <div className="space-y-5">
            {reservationsByDate.length ? (
              reservationsByDate.map((entry, index) => (
                <div key={entry.dateKey} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{formatDateHeading(entry.dateKey)}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-white/45">
                      {entry.reservations.length} reservation{entry.reservations.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <TimelineGrid
                    laneCount={listData?.laneCount ?? settings?.settings.lane_count ?? 12}
                    startHour={9}
                    endHour={23}
                    intervalMin={listData?.intervalMin ?? settings?.settings.slot_interval_min ?? 15}
                    reservationsWithLaneIndex={entry.reservations}
                    onReservationClick={handleReservationClick}
                    onTimelineReady={index === 0 ? setTimelineElement : undefined}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-white/60">No reservations in this range yet.</p>
            )}
          </div>
        )}
      </Card>

      <ReservationDrawer
        open={drawerOpen}
        reservation={selectedReservation}
        restaurantId={restaurantId}
        intervalMin={settings?.settings.slot_interval_min ?? 15}
        defaultDurationMin={settings?.settings.default_duration_min ?? 90}
        onOpenChange={setDrawerOpen}
        onUpdated={onDrawerUpdated}
      />
    </div>
  );
}
