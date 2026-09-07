"use client";

import { statusColor, rgba, type BookingStatusKey } from "@/lib/manage-booking/theme";

const LABELS: Record<BookingStatusKey, string> = {
  confirmed: "Confirmed",
  pending: "Waiting for confirmation",
  canceled: "Canceled",
  completed: "Completed",
  noshow: "Missed"
};

/** Small icon that reinforces status without relying on colour alone (a11y). */
function StatusGlyph({ status, color }: { status: BookingStatusKey; color: string }) {
  const common = {
    width: 11,
    height: 11,
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };
  if (status === "confirmed" || status === "completed") {
    return (
      <svg {...common}>
        <path d="M2 6.3 4.6 9 10 3.2" />
      </svg>
    );
  }
  if (status === "canceled") {
    return (
      <svg {...common}>
        <path d="M3 3l6 6M9 3l-6 6" />
      </svg>
    );
  }
  if (status === "noshow") {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="4.2" />
        <path d="M3.4 3.4l5.2 5.2" />
      </svg>
    );
  }
  // pending — clock
  return (
    <svg {...common}>
      <circle cx="6" cy="6" r="4.2" />
      <path d="M6 3.8V6l1.6 1" />
    </svg>
  );
}

export interface StatusIndicatorProps {
  status: BookingStatusKey;
  /** Optional override for the human label. */
  label?: string;
}

/** Restrained status pill — dot + glyph + label. Never a giant coloured banner. */
export function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const color = statusColor[status];
  return (
    <span
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 28,
        padding: "0 11px",
        borderRadius: 999,
        background: rgba(color, 0.13),
        color,
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: "nowrap"
      }}
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: 4, background: color, flex: "none" }}
      />
      <StatusGlyph status={status} color={color} />
      {label ?? LABELS[status]}
    </span>
  );
}
