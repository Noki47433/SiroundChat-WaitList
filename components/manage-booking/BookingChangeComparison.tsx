"use client";

import { rgba, surface, ink } from "@/lib/manage-booking/theme";

export interface ChangeSide {
  dateLabel: string;
  time: string;
}

export interface BookingChangeComparisonProps {
  current: ChangeSide;
  next: ChangeSide;
  serviceName: string | null;
  workerName: string | null;
  durationLabel: string | null;
  accent: string;
}

/** Current → New comparison card shown before confirming a reschedule. */
export function BookingChangeComparison({
  current,
  next,
  serviceName,
  workerName,
  durationLabel,
  accent
}: BookingChangeComparisonProps) {
  return (
    <div
      style={{
        borderRadius: 26,
        background: surface.card,
        border: `1px solid ${surface.line}`,
        padding: 20
      }}
    >
      <div style={{ opacity: 0.55 }}>
        <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: ink.secondary, marginBottom: 6 }}>
          Current
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#9E9EA8" }}>{current.dateLabel}</span>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>
            {current.time}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }} aria-hidden>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: rgba(accent, 0.14),
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none"
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M4 9.2 8 13.2l4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span style={{ flex: 1, height: 1, background: surface.line }} />
      </div>

      <div>
        <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: accent, marginBottom: 6 }}>
          New
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#C6C6D0" }}>{next.dateLabel}</span>
          <span
            style={{
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "-.028em",
              color: accent,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {next.time}
          </span>
        </div>
      </div>

      <div style={{ height: 1, background: surface.line, margin: "20px 0 16px" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 15, color: "#C6C6D0" }}>
        {serviceName ? (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: ink.secondary }}>Service</span>
            <span style={{ textAlign: "right" }}>{serviceName}</span>
          </div>
        ) : null}
        {workerName ? (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: ink.secondary }}>With</span>
            <span style={{ textAlign: "right" }}>{workerName}</span>
          </div>
        ) : null}
        {durationLabel ? (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: ink.secondary }}>Length</span>
            <span style={{ textAlign: "right" }}>{durationLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
