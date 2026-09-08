"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DM_Mono, Instrument_Sans } from "next/font/google";
import { motion, useReducedMotion } from "framer-motion";

import {
  deriveManageTokens,
  normalizeStatus,
  surface,
  ink,
  motion as motionTokens,
  type BookingStatusKey
} from "@/lib/manage-booking/theme";
import { BookingHeroCard, type BookingHeroData } from "@/components/manage-booking/BookingHeroCard";
import { BookingLinkChip } from "@/components/manage-booking/BookingLinkChip";
import { ActionCard } from "@/components/manage-booking/ActionCard";
import { DateCarousel, type CarouselDate } from "@/components/manage-booking/DateCarousel";
import { TimeSlot } from "@/components/manage-booking/TimeSlot";
import { BookingChangeComparison } from "@/components/manage-booking/BookingChangeComparison";
import { BottomActionSheet } from "@/components/manage-booking/BottomActionSheet";
import { OfflineBanner } from "@/components/manage-booking/OfflineBanner";
import { EmptyErrorState } from "@/components/manage-booking/EmptyErrorState";
import { SuccessState } from "@/components/manage-booking/SuccessState";
import { Toast } from "@/components/manage-booking/Toast";

// Fonts are scoped to this route via CSS variables applied on the root element.
const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-mb-sans", display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mb-mono", display: "swap" });

/* ────────────────────────── API types ────────────────────────── */

interface ApiTheme {
  primary: string;
  accent: string;
  secondary: string;
  background: string;
  text: string;
  shape: "rounded" | "pill" | "square";
}
interface ApiBooking {
  status: string;
  serviceName: string | null;
  customerName: string | null;
  startAt: string;
  endAt: string;
  durationMin: number | null;
  manageable: boolean;
  business: { name: string | null; logoUrl: string | null; theme: ApiTheme };
  worker: { name: string | null };
  location: { name: string | null; address: string | null; timezone: string };
}
interface Slot {
  startAtIso: string;
  date: string;
  label: string;
}
interface GetResponse {
  booking: ApiBooking;
  rescheduleSlots: Slot[];
}

type View = "loading" | "invalid" | "ratelimited" | "load-error" | "booking" | "pick" | "review" | "success";
type SheetKind = "cancel" | "cancel-closed" | "reschedule-closed" | null;

/* ────────────────────────── date/time formatting ────────────────────────── */

interface TimeParts {
  dayName: string;
  dow: string;
  day: string;
  dateLabel: string;
  time: string;
}
function formatParts(iso: string | null | undefined, tz: string): TimeParts {
  const empty: TimeParts = { dayName: "", dow: "", day: "", dateLabel: "", time: "" };
  if (!iso) return empty;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return empty;
  try {
    const f = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(d);
    return {
      dayName: f({ weekday: "long" }),
      dow: f({ weekday: "short" }),
      day: f({ day: "numeric" }),
      dateLabel: f({ day: "numeric", month: "long" }),
      time: f({ hour: "2-digit", minute: "2-digit", hour12: false })
    };
  } catch {
    return empty;
  }
}

/* ────────────────────────── page ────────────────────────── */

export default function ManageBookingPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const reduce = useReducedMotion();

  const [view, setView] = useState<View>("loading");
  const [data, setData] = useState<GetResponse | null>(null);
  const [offline, setOffline] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null); // startAtIso
  const [datesExpanded, setDatesExpanded] = useState(false);

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [canceling, setCanceling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmFailed, setConfirmFailed] = useState(false);
  const [slotTakenLabel, setSlotTakenLabel] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<TimeParts | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  /* ── data load ── */
  const load = useCallback(async () => {
    setView((v) => (v === "loading" || v === "load-error" || v === "invalid" || v === "ratelimited" ? "loading" : v));
    try {
      const res = await fetch(`/api/manage-booking/${token}`, { cache: "no-store" });
      if (res.status === 404) {
        setView("invalid");
        return;
      }
      if (res.status === 429) {
        setView("ratelimited");
        return;
      }
      if (!res.ok) {
        setView("load-error");
        return;
      }
      const body = (await res.json()) as GetResponse;
      setData(body);
      setView("booking");
    } catch {
      setView("load-error");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ── connectivity ── */
  useEffect(() => {
    if (typeof navigator !== "undefined") setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  /* ── derived ── */
  const booking = data?.booking ?? null;
  const tz = booking?.location.timezone ?? "UTC";
  const tokens = useMemo(() => deriveManageTokens(booking?.business.theme), [booking?.business.theme]);
  const statusKey: BookingStatusKey = normalizeStatus(booking?.status);
  const durationLabel = booking?.durationMin ? `${booking.durationMin} min` : null;

  const current = useMemo(() => formatParts(booking?.startAt, tz), [booking?.startAt, tz]);
  const endParts = useMemo(() => formatParts(booking?.endAt, tz), [booking?.endAt, tz]);

  // Group reschedule slots into calendar days for the date carousel.
  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of data?.rescheduleSlots ?? []) {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    }
    return map;
  }, [data?.rescheduleSlots]);

  const carouselDates: CarouselDate[] = useMemo(() => {
    return [...slotsByDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, arr]) => {
        const first = arr[0];
        const p = formatParts(first.startAtIso, tz);
        return { date, dow: p.dow, day: p.day, count: arr.length };
      });
  }, [slotsByDate, tz]);

  const daySlots: Slot[] = useMemo(() => {
    if (!selectedDate) return [];
    return (slotsByDate.get(selectedDate) ?? [])
      .slice()
      .sort((a, b) => a.startAtIso.localeCompare(b.startAtIso));
  }, [selectedDate, slotsByDate]);

  const selectedSlotObj = daySlots.find((s) => s.startAtIso === selectedSlot) ?? null;
  const selectedParts = useMemo(() => formatParts(selectedSlot, tz), [selectedSlot, tz]);

  const heroData: BookingHeroData | null = booking
    ? {
        status: statusKey,
        dayName: current.dayName,
        time: current.time,
        dateLabel: current.dateLabel,
        endTime: endParts.time || null,
        serviceName: booking.serviceName,
        durationLabel,
        workerName: booking.worker.name,
        address: booking.location.address ?? booking.location.name
      }
    : null;

  const businessName = booking?.business.name ?? "your appointment";

  // The tab, the history entry and any screenshot should say whose appointment
  // this is. Set here rather than in server metadata so the business never has to
  // be resolved from the token during rendering — the token stays out of the head
  // entirely. Falls back to the layout's generic title until the booking loads.
  useEffect(() => {
    const name = booking?.business.name?.trim();
    if (name) document.title = `Your booking · ${name}`;
  }, [booking?.business.name]);
  const historical = statusKey === "canceled" || statusKey === "completed" || statusKey === "noshow";

  /* ── flows ── */
  const resetFlow = () => {
    setSelectedDate(null);
    setSelectedSlot(null);
    setDatesExpanded(false);
    setConfirmFailed(false);
    setSlotTakenLabel(null);
  };

  const goReschedule = () => {
    if (offline) {
      showToast("You're offline — reconnect to change this booking.");
      return;
    }
    resetFlow();
    setView("pick");
  };

  const goCancel = () => {
    if (offline) {
      showToast("You're offline — reconnect to cancel.");
      return;
    }
    setSheet("cancel");
  };

  const backToBooking = () => {
    resetFlow();
    setView("booking");
  };

  const post = async (bodyObj: Record<string, unknown>) => {
    const res = await fetch(`/api/manage-booking/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bodyObj)
    });
    let body: { error?: string; ok?: boolean; startAt?: string; endAt?: string } = {};
    try {
      body = await res.json();
    } catch {
      /* keep empty */
    }
    return { res, body };
  };

  const confirmCancel = async () => {
    if (canceling) return;
    setCanceling(true);
    try {
      const { res, body } = await post({ action: "cancel" });
      if (res.ok) {
        setSheet(null);
        await load();
        showToast("Your booking has been canceled.");
        return;
      }
      if (res.status === 429) {
        setSheet(null);
        showToast("Too many attempts. Please try again in a few minutes.");
        return;
      }
      if (res.status === 409 && /too close/i.test(body.error ?? "")) {
        setSheet("cancel-closed");
        return;
      }
      // other non-ok — don't imply success
      showToast(body.error || "We couldn't cancel that just now. Please try again.");
    } catch {
      showToast("Connection issue — nothing was changed. Please try again.");
    } finally {
      setCanceling(false);
    }
  };

  const confirmReschedule = async () => {
    if (confirming || !selectedSlotObj || !selectedDate) return;
    setConfirming(true);
    setConfirmFailed(false);
    try {
      const { res, body } = await post({
        action: "reschedule",
        date: selectedDate,
        newStart: selectedSlotObj.startAtIso
      });
      if (res.ok) {
        const parts = formatParts(body.startAt ?? selectedSlotObj.startAtIso, tz);
        setSuccessInfo(parts);
        await load();
        setView("success");
        return;
      }
      if (res.status === 429) {
        showToast("Too many attempts. Please try again in a few minutes.");
        return;
      }
      const err = body.error ?? "";
      if (res.status === 409 && /(just taken|not available)/i.test(err)) {
        // Slot-taken race: surface it, refresh nearest alternatives, keep state.
        setSlotTakenLabel(selectedParts.time || null);
        setSelectedSlot(null);
        await load();
        setView("pick");
        return;
      }
      if (res.status === 409 && /too close/i.test(err)) {
        setView("booking");
        setSheet("reschedule-closed");
        await load();
        return;
      }
      if (res.status === 409 && /no longer/i.test(err)) {
        showToast(err);
        await load();
        setView("booking");
        return;
      }
      // generic failure — preserve selection, don't imply success
      setConfirmFailed(true);
    } catch {
      setConfirmFailed(true);
    } finally {
      setConfirming(false);
    }
  };

  /* ────────────────────────── render helpers ────────────────────────── */

  const headerTitle =
    view === "pick" ? "New time" : view === "review" ? "Review change" : view === "success" ? "Updated" : "Your booking";
  const inFlow = view === "pick" || view === "review";
  const bizInitial = (booking?.business.name ?? "S").trim().charAt(0).toUpperCase() || "S";

  return (
    <main
      className={`${instrumentSans.variable} ${dmMono.variable}`}
      style={{
        minHeight: "100vh",
        background: `radial-gradient(120% 80% at 50% -10%, #14141A 0%, ${surface.page} 60%)`,
        color: ink.primary,
        fontFamily: "var(--font-mb-sans), ui-sans-serif, system-ui, sans-serif",
        fontSize: 15,
        display: "flex",
        justifyContent: "center"
      }}
    >
      {/* Route-scoped keyframes (reduced-motion aware). */}
      <style>{`
        @keyframes mb-shimmer { from { background-position: -220px 0; } to { background-position: 320px 0; } }
        .mb-skel {
          background: linear-gradient(90deg, ${surface.raised} 0%, #1E1E25 50%, ${surface.raised} 100%);
          background-size: 260px 100%;
          animation: mb-shimmer 1.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) { .mb-skel { animation: none; } }
      `}</style>

      <div
        style={{
          ...tokens.cssVars,
          position: "relative",
          width: "100%",
          maxWidth: 520,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* header */}
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "28px 20px 14px"
          }}
        >
          {inFlow ? (
            <button
              type="button"
              onClick={backToBooking}
              aria-label="Back to booking"
              style={{
                width: 38,
                height: 38,
                flex: "none",
                border: 0,
                borderRadius: 19,
                background: surface.raised,
                color: "#D8D8DE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
            >
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <path d="M11 3.5 6 9l5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: ink.meta }}>
              {booking?.business.name ?? "SurroundChat"}
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.016em", marginTop: 2 }}>{headerTitle}</div>
          </div>
          {!inFlow && view !== "success" && booking ? (
            <div
              aria-hidden
              style={{
                width: 34,
                height: 34,
                flex: "none",
                borderRadius: 12,
                background: tokens.accentSofter,
                color: tokens.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 600
              }}
            >
              {bizInitial}
            </div>
          ) : null}
        </div>

        {/* body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: "0 20px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 14
          }}
        >
          {view === "loading" ? <LoadingSkeleton /> : null}

          {view === "invalid" ? (
            <EmptyErrorState
              glyph="link-off"
              title="This booking link is no longer available"
              body="Links stay live until a day after the appointment, then close for your privacy. If you still need a change, a quick message will sort it."
              accent={tokens.accent}
              onAccent={tokens.onAccent}
              secondaryLabel="Try again"
              onSecondary={() => void load()}
            />
          ) : null}

          {view === "ratelimited" ? (
            <EmptyErrorState
              glyph="clock"
              title="Let's slow down for a moment"
              body="That's a lot of activity in a short time. Please wait a few minutes, then try again."
              accent={tokens.accent}
              onAccent={tokens.onAccent}
              primaryLabel="Try again"
              onPrimary={() => void load()}
            />
          ) : null}

          {view === "load-error" ? (
            <EmptyErrorState
              glyph="wifi-off"
              title="We couldn't load your booking"
              body="Something got in the way. Check your connection and try again — nothing has changed."
              accent={tokens.accent}
              onAccent={tokens.onAccent}
              primaryLabel="Try again"
              onPrimary={() => void load()}
            />
          ) : null}

          {/* ── main booking view ── */}
          {view === "booking" && booking && heroData ? (
            <>
              {offline ? <OfflineBanner onRetry={() => void load()} accent={tokens.accent} /> : null}
              <BookingLinkChip accent={tokens.accent} />
              <BookingHeroCard booking={heroData} accent={tokens.accent} dimmed={historical} />

              {statusKey === "pending" ? (
                <NoteCard
                  title="Waiting for confirmation"
                  body={`${businessName} approves bookings by hand and usually replies within a couple of hours. You'll get a message the moment it's confirmed.`}
                />
              ) : null}

              {statusKey === "confirmed" && !booking.manageable ? (
                <NoteCard
                  title="Online changes are closed"
                  body={`Changes online close shortly before your appointment so the slot isn't left empty. ${businessName} can still help you directly.`}
                />
              ) : null}

              {statusKey === "canceled" ? (
                <NoteCard
                  title="This time has been released"
                  body={`Your ${current.time || "reserved"} slot on ${current.dateLabel || "this day"} is back in the calendar. Nothing was charged.`}
                />
              ) : null}

              {statusKey === "completed" ? (
                <NoteCard title="All done" body="Thanks for coming in. We hope to see you again soon." />
              ) : null}

              {statusKey === "noshow" ? (
                <NoteCard title="Marked as missed" body="You didn't make it to this appointment. You can always book again with a quick message." />
              ) : null}

              {statusKey === "confirmed" && booking.manageable ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 2 }}>
                  <ActionCard
                    label="Reschedule"
                    hint="Pick another day or time"
                    variant="accent"
                    accent={tokens.accent}
                    disabled={offline}
                    onClick={goReschedule}
                    icon={
                      <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M3 5.6h14v11.4H3zM3 9h14M7 3v3M13 3v3"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    }
                  />
                  <ActionCard
                    label="Cancel booking"
                    hint="Frees your reserved time"
                    variant="neutral"
                    accent={tokens.accent}
                    disabled={offline}
                    onClick={goCancel}
                    icon={
                      <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                  />
                </div>
              ) : null}

              <FooterNote
                text={
                  historical || statusKey === "pending"
                    ? `Questions? Just message ${businessName}.`
                    : booking.manageable
                      ? "Free to change or cancel up to shortly before your appointment."
                      : "Online changes are closed for this appointment."
                }
              />
            </>
          ) : null}

          {/* ── reschedule: pick ── */}
          {view === "pick" && booking ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.state }}
              style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
              {offline ? <OfflineBanner onRetry={() => void load()} accent={tokens.accent} /> : null}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: surface.card,
                  border: `1px solid ${surface.line}`
                }}
              >
                <span style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: ink.meta }}>Now</span>
                <span style={{ flex: 1, fontSize: 14.5, color: "#B4B4BE", fontVariantNumeric: "tabular-nums" }}>
                  {current.dayName} {current.dateLabel} · {current.time}
                </span>
              </div>

              {slotTakenLabel ? (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: "rgba(196,142,20,.09)",
                    border: "1px solid rgba(196,142,20,.28)"
                  }}
                >
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "#F0D492", marginBottom: 3 }}>That time was just booked</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#B9AC8E" }}>
                    Someone took {slotTakenLabel} a moment ago. The closest options are below.
                  </div>
                </div>
              ) : null}

              {carouselDates.length === 0 ? (
                <EmptyErrorState
                  glyph="calendar-x"
                  title="No times available right now"
                  body={`${businessName} is fully booked for the next couple of weeks. Your current appointment is still reserved.`}
                  accent={tokens.accent}
                  onAccent={tokens.onAccent}
                  primaryLabel="Keep my current booking"
                  onPrimary={backToBooking}
                />
              ) : (
                <>
                  <DateCarousel
                    dates={carouselDates}
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                      setSlotTakenLabel(null);
                    }}
                    accent={tokens.accent}
                    expanded={datesExpanded}
                    onToggleExpanded={() => setDatesExpanded((e) => !e)}
                  />

                  {selectedDate && daySlots.length > 0 ? (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          marginBottom: 12
                        }}
                      >
                        <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: ink.meta }}>
                          Available times
                        </div>
                        <div style={{ fontSize: 12.5, color: ink.meta }}>{daySlots.length} open</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9 }}>
                        {daySlots.map((s) => {
                          const p = formatParts(s.startAtIso, tz);
                          return (
                            <TimeSlot
                              key={s.startAtIso}
                              label={p.time}
                              active={selectedSlot === s.startAtIso}
                              onSelect={() => setSelectedSlot(s.startAtIso)}
                              accent={tokens.accent}
                              onAccent={tokens.onAccent}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {selectedSlot ? (
                    <motion.button
                      type="button"
                      onClick={() => setView("review")}
                      whileTap={reduce ? undefined : { scale: 0.99 }}
                      transition={{ duration: motionTokens.press }}
                      style={{
                        position: "sticky",
                        bottom: 12,
                        width: "100%",
                        minHeight: 56,
                        border: 0,
                        borderRadius: 18,
                        background: tokens.accent,
                        color: tokens.onAccent,
                        font: "inherit",
                        fontSize: 16.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: `0 14px 30px -16px ${tokens.accentGlow}`
                      }}
                    >
                      Review change
                    </motion.button>
                  ) : null}
                </>
              )}
            </motion.div>
          ) : null}

          {/* ── reschedule: review ── */}
          {view === "review" && booking ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.state }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <BookingChangeComparison
                current={{ dateLabel: `${current.dayName} ${current.dateLabel}`, time: current.time }}
                next={{ dateLabel: `${selectedParts.dayName} ${selectedParts.dateLabel}`, time: selectedParts.time }}
                serviceName={booking.serviceName}
                workerName={booking.worker.name}
                durationLabel={durationLabel}
                accent={tokens.accent}
              />

              {confirmFailed ? (
                <div
                  role="alert"
                  style={{
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: surface.raised,
                    border: `1px solid ${surface.lineStrong}`
                  }}
                >
                  <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 3 }}>We couldn&apos;t confirm the change yet</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#9E9EA8" }}>
                    Nothing has changed — your {current.time} slot is still yours. Please check your connection and try again.
                  </div>
                </div>
              ) : null}

              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <motion.button
                  type="button"
                  onClick={confirmReschedule}
                  disabled={confirming}
                  whileTap={reduce || confirming ? undefined : { scale: 0.99 }}
                  transition={{ duration: motionTokens.press }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    minHeight: 56,
                    border: 0,
                    borderRadius: 17,
                    background: tokens.accent,
                    color: tokens.onAccent,
                    font: "inherit",
                    fontSize: 16.5,
                    fontWeight: 600,
                    cursor: confirming ? "default" : "pointer",
                    opacity: confirming ? 0.85 : 1
                  }}
                >
                  {confirming ? (
                    <span style={{ display: "flex", gap: 4 }} aria-hidden>
                      {[0, 0.14, 0.28].map((d) => (
                        <motion.span
                          key={d}
                          animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
                          transition={reduce ? undefined : { duration: 1.1, delay: d, repeat: Infinity, ease: "easeInOut" }}
                          style={{ width: 6, height: 6, borderRadius: 4, background: tokens.onAccent }}
                        />
                      ))}
                    </span>
                  ) : confirmFailed ? (
                    "Try again"
                  ) : (
                    "Confirm new time"
                  )}
                </motion.button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmFailed(false);
                    setView("pick");
                  }}
                  style={{
                    minHeight: 52,
                    border: 0,
                    borderRadius: 16,
                    background: "none",
                    color: "#A8A8B2",
                    font: "inherit",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Go back
                </button>
              </div>
            </motion.div>
          ) : null}

          {/* ── reschedule: success ── */}
          {view === "success" && booking ? (
            <>
              <SuccessState
                title="You're all set"
                body={`Your appointment moved to ${successInfo?.dayName ?? current.dayName} at ${
                  successInfo?.time ?? current.time
                }. We've sent the updated details to your phone.`}
                accent={tokens.accent}
              />
              {heroData ? (
                <>
                  <BookingLinkChip accent={tokens.accent} />
                  <BookingHeroCard booking={heroData} accent={tokens.accent} />
                </>
              ) : null}
              <div style={{ marginTop: 2 }}>
                <ActionCard
                  label="Done"
                  hint="Back to your booking"
                  variant="accent"
                  accent={tokens.accent}
                  onClick={backToBooking}
                  icon={
                    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10.4 8.2 14.5 16 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                />
              </div>
            </>
          ) : null}
        </div>

        {/* bottom sheet: cancel / window-closed */}
        <BottomActionSheet
          open={sheet === "cancel"}
          onClose={() => setSheet(null)}
          title="Cancel this booking?"
          body="This frees your reserved time straight away. You can always book again afterwards."
          keepLabel="Keep booking"
          destructiveLabel="Cancel booking"
          onDestructive={confirmCancel}
          destructiveBusy={canceling}
          accent={tokens.accent}
        >
          {booking ? (
            <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 18, background: "#121216", display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.012em", fontVariantNumeric: "tabular-nums" }}>
                {current.dayName} {current.dateLabel} · {current.time}
              </div>
              <div style={{ fontSize: 13.5, color: ink.secondary }}>
                {[booking.serviceName, booking.worker.name ? `with ${booking.worker.name}` : null].filter(Boolean).join(" ")}
              </div>
            </div>
          ) : null}
        </BottomActionSheet>

        <BottomActionSheet
          open={sheet === "cancel-closed"}
          onClose={() => setSheet(null)}
          title="Cancelling online has closed"
          body={`${businessName} stops online changes shortly before your appointment, so the slot isn't left empty. A quick message still works.`}
          keepLabel="Keep my booking"
          accent={tokens.accent}
        />

        <BottomActionSheet
          open={sheet === "reschedule-closed"}
          onClose={() => setSheet(null)}
          title="Too close to change online"
          body={`Moving an appointment online closes shortly before the time. ${businessName} can usually find you another slot directly.`}
          keepLabel="Keep my booking"
          accent={tokens.accent}
        />

        <Toast message={toast} />
      </div>
    </main>
  );
}

/* ────────────────────────── small local presentational bits ────────────────────────── */

function NoteCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: "16px 18px", borderRadius: 20, background: surface.card, border: `1px solid ${surface.line}` }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#9E9EA8" }}>{body}</div>
    </div>
  );
}

function FooterNote({ text }: { text: string }) {
  return (
    <div style={{ marginTop: "auto", paddingTop: 22, textAlign: "center", fontSize: 12, lineHeight: 1.6, color: ink.faint }}>
      {text}
      <br />
      Booked with SurroundChat
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-hidden>
      <div className="mb-skel" style={{ height: 44, borderRadius: 14 }} />
      <div className="mb-skel" style={{ height: 232, borderRadius: 28 }} />
      <div className="mb-skel" style={{ height: 72, borderRadius: 20 }} />
      <div className="mb-skel" style={{ height: 72, borderRadius: 20 }} />
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }} role="status" aria-live="polite">
        Loading your booking
      </span>
    </div>
  );
}
