"use client";

import { motion, useReducedMotion } from "framer-motion";
import { rgba, surface, ink, motion as motionTokens } from "@/lib/manage-booking/theme";

export interface CarouselDate {
  /** YYYY-MM-DD key. */
  date: string;
  /** Short weekday, e.g. "Mon". */
  dow: string;
  /** Day-of-month, e.g. "18". */
  day: string;
  /** Number of open slots on this day. */
  count: number;
}

export interface DateCarouselProps {
  dates: CarouselDate[];
  selected: string | null;
  onSelect: (date: string) => void;
  accent: string;
  /** Whether all dates are shown (vs. the first page). */
  expanded: boolean;
  onToggleExpanded: () => void;
  /** How many to show before "More dates". */
  collapsedCount?: number;
}

/**
 * Horizontal, touch-friendly date strip — not a month wall. Shows a "More dates"
 * affordance instead of paging a full calendar.
 */
export function DateCarousel({
  dates,
  selected,
  onSelect,
  accent,
  expanded,
  onToggleExpanded,
  collapsedCount = 7
}: DateCarouselProps) {
  const reduce = useReducedMotion();
  const visible = expanded ? dates : dates.slice(0, collapsedCount);
  const hasMore = dates.length > collapsedCount;

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: ink.meta,
          marginBottom: 12
        }}
      >
        Pick a day
      </div>
      <div
        role="listbox"
        aria-label="Available days"
        style={{
          display: "flex",
          gap: 9,
          overflowX: "auto",
          padding: "0 20px 6px",
          margin: "0 -20px",
          scrollSnapType: "x mandatory"
        }}
      >
        {visible.map((d) => {
          const active = selected === d.date;
          return (
            <motion.button
              key={d.date}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(d.date)}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              animate={reduce ? undefined : { y: active ? -2 : 0 }}
              transition={{ duration: motionTokens.state }}
              style={{
                flex: "none",
                width: 58,
                minHeight: 80,
                borderRadius: 19,
                scrollSnapAlign: "start",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                border: active ? `1px solid ${rgba(accent, 0.55)}` : `1px solid ${surface.line}`,
                background: active ? rgba(accent, 0.16) : surface.raised,
                color: active ? accent : "#EDEDF2",
                font: "inherit",
                cursor: "pointer",
                transition: reduce ? "none" : "background .16s ease, color .16s ease"
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: ".04em", opacity: 0.72 }}>{d.dow}</span>
              <span style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>
                {d.day}
              </span>
              <span
                aria-hidden
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 3,
                  background: active ? accent : "#4E4E58"
                }}
              />
            </motion.button>
          );
        })}
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          style={{
            marginTop: 12,
            minHeight: 44,
            border: 0,
            background: "none",
            font: "inherit",
            fontSize: 14,
            fontWeight: 600,
            color: accent,
            cursor: "pointer",
            padding: "8px 2px"
          }}
        >
          {expanded ? "Fewer dates" : "More dates"}
        </button>
      ) : null}
    </div>
  );
}
