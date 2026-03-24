"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ReservationRecord } from "@/lib/reservations/types";
import { ReservationBlock } from "@/components/reservations/ReservationBlock";

const ROW_HEIGHT = 60;
const LABEL_COL_WIDTH = 88;
const PX_PER_MINUTE = 2.8;

const toMinuteOfDay = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getHours() * 60 + date.getMinutes();
};

const formatHourLabel = (minuteOfDay: number) => {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

export function TimelineGrid({
  laneCount,
  startHour = 9,
  endHour = 23,
  intervalMin,
  reservationsWithLaneIndex,
  onReservationClick,
  onTimelineReady
}: {
  laneCount: number;
  startHour?: number;
  endHour?: number;
  intervalMin: number;
  reservationsWithLaneIndex: ReservationRecord[];
  onReservationClick: (reservation: ReservationRecord) => void;
  onTimelineReady?: (element: HTMLDivElement | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onTimelineReady?.(scrollRef.current);
    return () => onTimelineReady?.(null);
  }, [onTimelineReady]);

  const startMinute = startHour * 60;
  const endMinute = endHour * 60;
  const totalMinutes = Math.max(1, endMinute - startMinute);
  const totalWidth = Math.max(960, totalMinutes * PX_PER_MINUTE);

  const intervalLines = useMemo(() => {
    const points: number[] = [];
    for (let minute = startMinute; minute <= endMinute; minute += intervalMin) {
      points.push(minute);
    }
    return points;
  }, [endMinute, intervalMin, startMinute]);

  const rows = useMemo(() => {
    const totalRows = laneCount + 1;
    return Array.from({ length: totalRows }, (_, index) => {
      const reservations = reservationsWithLaneIndex.filter((reservation) => reservation.lane_index === index);
      return {
        index,
        label: index < laneCount ? `T${index + 1}` : "Overflow",
        reservations
      };
    });
  }, [laneCount, reservationsWithLaneIndex]);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <div className="flex">
        <div className="shrink-0 border-r border-white/10" style={{ width: LABEL_COL_WIDTH }}>
          <div className="flex h-11 items-center justify-center border-b border-white/10 text-[11px] uppercase tracking-[0.2em] text-white/45">
            Lanes
          </div>
          {rows.map((row) => (
            <div
              key={row.index}
              className="flex items-center justify-center border-b border-white/5 text-sm font-medium text-white/75"
              style={{ height: ROW_HEIGHT }}
            >
              {row.label}
            </div>
          ))}
        </div>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div style={{ width: totalWidth }}>
            <div className="relative h-11 border-b border-white/10">
              {intervalLines.map((minute) => {
                const left = ((minute - startMinute) / totalMinutes) * totalWidth;
                const isHour = minute % 60 === 0;
                return (
                  <div
                    key={`h-${minute}`}
                    className={isHour ? "absolute inset-y-0 w-px bg-white/20" : "absolute inset-y-0 w-px bg-white/7"}
                    style={{ left }}
                  >
                    {isHour ? (
                      <span className="absolute left-1 top-2 text-[11px] text-white/55">{formatHourLabel(minute)}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {rows.map((row) => (
              <div key={`row-${row.index}`} className="relative border-b border-white/5" style={{ height: ROW_HEIGHT }}>
                {intervalLines.map((minute) => {
                  const left = ((minute - startMinute) / totalMinutes) * totalWidth;
                  return (
                    <div
                      key={`row-${row.index}-line-${minute}`}
                      className={minute % 60 === 0 ? "absolute inset-y-0 w-px bg-white/10" : "absolute inset-y-0 w-px bg-white/5"}
                      style={{ left }}
                    />
                  );
                })}

                {row.reservations.map((reservation) => {
                  const reservationStart = toMinuteOfDay(reservation.start_at);
                  const reservationEnd = toMinuteOfDay(reservation.end_at);
                  const clampedStart = Math.max(startMinute, reservationStart);
                  const clampedEnd = Math.min(endMinute, reservationEnd);
                  const duration = Math.max(15, clampedEnd - clampedStart);

                  const left = ((clampedStart - startMinute) / totalMinutes) * totalWidth;
                  const width = Math.max(56, (duration / totalMinutes) * totalWidth);

                  return (
                    <ReservationBlock
                      key={reservation.id}
                      reservation={reservation}
                      laneIndex={row.index}
                      onClick={onReservationClick}
                      style={{ left, width }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
