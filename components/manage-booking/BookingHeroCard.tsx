"use client";

import { motion, useReducedMotion } from "framer-motion";
import { StatusIndicator } from "./StatusIndicator";
import { surface, ink, motion as motionTokens, type BookingStatusKey } from "@/lib/manage-booking/theme";

export interface BookingHeroData {
  status: BookingStatusKey;
  dayName: string;
  time: string;
  dateLabel: string;
  endTime: string | null;
  serviceName: string | null;
  durationLabel: string | null;
  workerName: string | null;
  address: string | null;
}

export interface BookingHeroCardProps {
  booking: BookingHeroData;
  accent: string;
  /** Historical/inactive bookings render dimmed. */
  dimmed?: boolean;
}

function MetaIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        width: 28,
        height: 28,
        flex: "none",
        borderRadius: 10,
        background: surface.inset,
        color: ink.secondary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {children}
    </span>
  );
}

/** The booking hero — time is the hero (big tabular-nums), status a restrained pill. */
export function BookingHeroCard({ booking, accent, dimmed = false }: BookingHeroCardProps) {
  const reduce = useReducedMotion();
  const timeColor = dimmed ? "#9A9AA4" : accent;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: dimmed ? 0.68 : 1, y: 0 }}
      transition={{ duration: motionTokens.success, ease: "easeOut" }}
      style={{
        borderRadius: 28,
        background: surface.card,
        border: `1px solid ${surface.line}`,
        padding: 20,
        boxShadow: "0 1px 0 rgba(255,255,255,.04) inset, 0 18px 40px -26px rgba(0,0,0,.9)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <StatusIndicator status={booking.status} />
      </div>

      <div style={{ marginTop: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: ".02em", color: ink.secondary }}>
            {booking.dayName}
          </div>
          <div
            style={{
              fontSize: 58,
              fontWeight: 600,
              letterSpacing: "-.04em",
              lineHeight: 1.02,
              fontVariantNumeric: "tabular-nums",
              color: timeColor,
              marginTop: 2
            }}
          >
            {booking.time}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-.018em",
              color: "#EDEDF2",
              marginTop: -2
            }}
          >
            {booking.dateLabel}
          </div>
        </div>
        {booking.endTime ? (
          <div style={{ textAlign: "right", flex: "none", paddingBottom: 6 }}>
            <div style={{ fontSize: 13, color: "#75757F" }}>Ends</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: "#B4B4BE",
                fontVariantNumeric: "tabular-nums"
              }}
            >
              {booking.endTime}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ height: 1, background: surface.line, margin: "20px 0 16px" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {booking.serviceName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MetaIcon>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 12.5c.6-2.2 2.5-3.4 5-3.4s4.4 1.2 5 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="8" cy="5.4" r="2.6" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </MetaIcon>
            <span style={{ flex: 1, fontSize: 15.5, fontWeight: 500 }}>{booking.serviceName}</span>
            {booking.durationLabel ? (
              <span style={{ fontSize: 14, color: ink.secondary }}>{booking.durationLabel}</span>
            ) : null}
          </div>
        ) : null}

        {booking.workerName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MetaIcon>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 5.2V8l2 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </MetaIcon>
            <span style={{ flex: 1, fontSize: 15.5, color: "#C6C6D0" }}>with {booking.workerName}</span>
          </div>
        ) : null}

        {booking.address ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MetaIcon>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 14s4.5-4.1 4.5-7A4.5 4.5 0 0 0 3.5 7c0 2.9 4.5 7 4.5 7Z" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="8" cy="6.9" r="1.6" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </MetaIcon>
            <span style={{ flex: 1, fontSize: 15.5, color: "#C6C6D0" }}>{booking.address}</span>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
