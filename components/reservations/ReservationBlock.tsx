"use client";

import type { CSSProperties } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import type { ReservationRecord } from "@/lib/reservations/types";
import { cn } from "@/lib/utils/cn";

const statusClass: Record<ReservationRecord["status"], string> = {
  pending: "border-amber-400/50 bg-amber-500/25 text-amber-50",
  confirmed: "border-emerald-400/50 bg-emerald-500/30 text-emerald-50",
  seated: "border-sky-400/50 bg-sky-500/30 text-sky-50",
  completed: "border-zinc-400/40 bg-zinc-500/30 text-zinc-100",
  canceled: "border-white/20 bg-white/10 text-white/65",
  no_show: "border-orange-400/50 bg-orange-500/30 text-orange-50"
};

const formatTimeRange = (startAt: string, endAt: string) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startAt} - ${endAt}`;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

export function ReservationBlock({
  reservation,
  laneIndex,
  onClick,
  style
}: {
  reservation: ReservationRecord;
  laneIndex: number;
  onClick: (reservation: ReservationRecord) => void;
  style?: CSSProperties;
}) {
  const tooltipLabel = `${reservation.customer_name} • Party ${reservation.party_size} • ${formatTimeRange(
    reservation.start_at,
    reservation.end_at
  )} • ${reservation.status}`;

  return (
    <Tooltip label={tooltipLabel}>
      <button
        type="button"
        style={style}
        onClick={() => onClick(reservation)}
        className={cn(
          "absolute top-1.5 flex h-12 items-center overflow-hidden rounded-xl border px-2 text-left text-xs font-medium shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition hover:brightness-110",
          statusClass[reservation.status]
        )}
        aria-label={`Open reservation ${reservation.customer_name} in lane ${laneIndex + 1}`}
      >
        <span className="truncate">{reservation.customer_name}</span>
      </button>
    </Tooltip>
  );
}
