"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Clock3, Loader2, Minus, NotebookPen, PhoneCall, Plus, UserRound, UsersRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

const NOTES_LIMIT = 400;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export type ManualReservationRecord = {
  id: string;
  source: "website" | "whatsapp" | "manual";
  source_conversation_id: string | null;
  start_at: string;
  end_at: string;
  party_size: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  special_request: string | null;
  status: "pending" | "confirmed" | "completed" | "canceled" | "seated" | "no_show";
  created_by: string;
  created_at: string;
};

export type ManualReservationValues = {
  customerName: string;
  customerPhone: string;
  partySize: string;
  date: string;
  time: string;
  notes: string;
};

type ManualReservationErrors = Partial<Record<keyof ManualReservationValues, string>>;

const getTodayInTimeZone = (timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
};

const buildDefaultValues = (timeZone: string): ManualReservationValues => ({
  customerName: "",
  customerPhone: "",
  partySize: "2",
  date: getTodayInTimeZone(timeZone),
  time: "",
  notes: ""
});

const normalizePartySize = (value: string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(99, Math.max(1, Math.round(numeric)));
};

const validateValues = (values: ManualReservationValues): ManualReservationErrors => {
  const errors: ManualReservationErrors = {};

  if (!values.customerName.trim()) {
    errors.customerName = "Guest name is required.";
  }

  if (!values.customerPhone.trim()) {
    errors.customerPhone = "Phone number is required.";
  }

  const partySize = Number(values.partySize);
  if (!Number.isInteger(partySize) || partySize < 1) {
    errors.partySize = "Guests must be at least 1.";
  }

  if (!DATE_PATTERN.test(values.date)) {
    errors.date = "Select a valid date.";
  }

  if (!TIME_PATTERN.test(values.time)) {
    errors.time = "Select a valid time.";
  }

  if (values.notes.trim().length > NOTES_LIMIT) {
    errors.notes = `Notes must be ${NOTES_LIMIT} characters or less.`;
  }

  return errors;
};

const iconWrapClassName =
  "flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#ffe08a]";

const fieldClassName = (hasError: boolean) =>
  cn(
    "h-12 rounded-2xl border-white/10 bg-white/[0.04] text-base text-white placeholder:text-white/38 focus-visible:ring-[#ffd872]/45",
    hasError && "border-red-300/60 focus-visible:ring-red-300/45"
  );

const textAreaClassName = (hasError: boolean) =>
  cn(
    "min-h-[120px] rounded-2xl border-white/10 bg-white/[0.04] text-base text-white placeholder:text-white/38 focus-visible:ring-[#ffd872]/45",
    hasError && "border-red-300/60 focus-visible:ring-red-300/45"
  );

export function AddReservationDialog({
  open,
  onOpenChange,
  timeZone,
  slotIntervalMin,
  onCreated
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeZone: string;
  slotIntervalMin: number;
  onCreated: (reservation: ManualReservationRecord, values: ManualReservationValues) => void;
}) {
  const { push } = useToast();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const [values, setValues] = useState<ManualReservationValues>(() => buildDefaultValues(timeZone));
  const [errors, setErrors] = useState<ManualReservationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback((nextTimeZone: string) => {
    setValues(buildDefaultValues(nextTimeZone));
    setErrors({});
    setSubmitError(null);
  }, []);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetForm(timeZone);
      const focusTimer = window.setTimeout(() => {
        nameInputRef.current?.focus();
      }, 40);

      wasOpenRef.current = true;
      return () => window.clearTimeout(focusTimer);
    }

    if (!open && wasOpenRef.current) {
      resetForm(timeZone);
      wasOpenRef.current = false;
    }

    return undefined;
  }, [open, resetForm, timeZone]);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handleFieldChange = <T extends keyof ManualReservationValues>(field: T, nextValue: ManualReservationValues[T]) => {
    setValues((current) => ({ ...current, [field]: nextValue }));
    setErrors((current) => {
      if (!current[field]) return current;
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
    setSubmitError(null);
  };

  const handlePartySizeStep = (direction: -1 | 1) => {
    const nextValue = normalizePartySize(values.partySize || "1") + direction;
    handleFieldChange("partySize", String(Math.min(99, Math.max(1, nextValue))));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateValues(values);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setSubmitError("Fill in the required details before saving.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const response = await fetch("/api/reservations/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: values.customerName.trim(),
        customerPhone: values.customerPhone.trim(),
        partySize: normalizePartySize(values.partySize),
        date: values.date,
        time: values.time,
        notes: values.notes.trim() || null
      })
    });

    const payload = (await response.json().catch(() => null)) as
      | { reservation?: ManualReservationRecord; error?: string; code?: string; remainingCapacity?: number }
      | { error?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } }
      | null;

    setIsSubmitting(false);

    if (!response.ok || !payload || !("reservation" in payload) || !payload.reservation) {
      const fieldErrors =
        payload && "error" in payload && payload.error && typeof payload.error === "object" && "fieldErrors" in payload.error
          ? payload.error.fieldErrors
          : null;

      if (fieldErrors) {
        const nextFieldErrors: ManualReservationErrors = {};
        if (fieldErrors.customerName?.[0]) nextFieldErrors.customerName = fieldErrors.customerName[0];
        if (fieldErrors.customerPhone?.[0]) nextFieldErrors.customerPhone = fieldErrors.customerPhone[0];
        if (fieldErrors.partySize?.[0]) nextFieldErrors.partySize = fieldErrors.partySize[0];
        if (fieldErrors.date?.[0]) nextFieldErrors.date = fieldErrors.date[0];
        if (fieldErrors.time?.[0]) nextFieldErrors.time = fieldErrors.time[0];
        if (fieldErrors.notes?.[0]) nextFieldErrors.notes = fieldErrors.notes[0];
        setErrors(nextFieldErrors);
      }

      const errorMessage =
        payload && "code" in payload && payload.code === "capacity_conflict" && typeof payload.remainingCapacity === "number"
          ? `Only ${payload.remainingCapacity} seats left at that time.`
          : payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Couldn’t add reservation. Please try again.";

      setSubmitError(errorMessage);
      push({
        title: "Couldn’t add reservation",
        message: errorMessage,
        variant: "error"
      });
      return;
    }

    push({
      title: "Reservation added",
      message: "The reservation is now in your dashboard.",
      variant: "success"
    });
    onCreated(payload.reservation, values);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-[#02060d]/80 backdrop-blur-md"
        onClick={handleClose}
        aria-label="Close add reservation dialog"
      />

      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6">
        <form
          onSubmit={handleSubmit}
          className="relative mx-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-[#ffe3a0]/14 bg-[#07111c]/95 text-white shadow-[0_40px_120px_rgba(0,0,0,0.65)] animate-[wrapped-stack_180ms_ease-out] sm:rounded-[2rem]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-reservation-title"
        >
          <div className="relative overflow-hidden border-b border-white/10 px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,216,74,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_26%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">Confirmed instantly</Badge>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/72">
                    Manual entry
                  </span>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#ffe08a]/78">Reservation intake</p>
                  <h2 id="add-reservation-title" className="dashboard-heading mt-3 text-2xl font-semibold text-white sm:text-[2rem]">
                    Add Reservation
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/66">
                    Log phone calls, walk-ins, Viber, or any reservation your team confirmed offline.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close add reservation dialog"
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-3">
                <span className="text-xs uppercase tracking-[0.18em] text-white/46">Guest name</span>
                <div className="flex items-center gap-3">
                  <span className={iconWrapClassName}>
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <Input
                      ref={nameInputRef}
                      value={values.customerName}
                      onChange={(event) => handleFieldChange("customerName", event.target.value)}
                      placeholder="e.g. Arta Krasniqi"
                      className={fieldClassName(Boolean(errors.customerName))}
                      autoComplete="name"
                    />
                  </div>
                </div>
                {errors.customerName ? <p className="text-sm text-red-200">{errors.customerName}</p> : null}
              </label>

              <label className="space-y-3">
                <span className="text-xs uppercase tracking-[0.18em] text-white/46">Phone number</span>
                <div className="flex items-center gap-3">
                  <span className={iconWrapClassName}>
                    <PhoneCall className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <Input
                      value={values.customerPhone}
                      onChange={(event) => handleFieldChange("customerPhone", event.target.value)}
                      placeholder="e.g. +383 44 123 456"
                      className={fieldClassName(Boolean(errors.customerPhone))}
                      autoComplete="tel"
                      inputMode="tel"
                    />
                  </div>
                </div>
                {errors.customerPhone ? <p className="text-sm text-red-200">{errors.customerPhone}</p> : null}
              </label>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <label className="space-y-3">
                <span className="text-xs uppercase tracking-[0.18em] text-white/46">Guests</span>
                <div
                  className={cn(
                    "flex h-12 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-2",
                    errors.partySize && "border-red-300/60"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handlePartySizeStep(-1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/72 transition hover:bg-white/[0.08] hover:text-white"
                    aria-label="Decrease guests"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="relative flex-1">
                    <UsersRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ffe08a]" />
                    <Input
                      value={values.partySize}
                      onChange={(event) => handleFieldChange("partySize", event.target.value.replace(/[^\d]/g, ""))}
                      className="h-10 border-0 bg-transparent pl-10 pr-3 text-center text-base focus-visible:ring-0"
                      inputMode="numeric"
                      aria-label="Guests"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePartySizeStep(1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/72 transition hover:bg-white/[0.08] hover:text-white"
                    aria-label="Increase guests"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {errors.partySize ? <p className="text-sm text-red-200">{errors.partySize}</p> : null}
              </label>

              <label className="space-y-3">
                <span className="text-xs uppercase tracking-[0.18em] text-white/46">Date</span>
                <div className="flex items-center gap-3">
                  <span className={iconWrapClassName}>
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <Input
                      type="date"
                      value={values.date}
                      onChange={(event) => handleFieldChange("date", event.target.value)}
                      className={cn(fieldClassName(Boolean(errors.date)), "[color-scheme:dark]")}
                    />
                  </div>
                </div>
                {errors.date ? <p className="text-sm text-red-200">{errors.date}</p> : null}
              </label>

              <label className="space-y-3">
                <span className="text-xs uppercase tracking-[0.18em] text-white/46">Time</span>
                <div className="flex items-center gap-3">
                  <span className={iconWrapClassName}>
                    <Clock3 className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <Input
                      type="time"
                      value={values.time}
                      onChange={(event) => handleFieldChange("time", event.target.value)}
                      className={cn(fieldClassName(Boolean(errors.time)), "[color-scheme:dark]")}
                      step={Math.max(300, slotIntervalMin * 60)}
                    />
                  </div>
                </div>
                {errors.time ? <p className="text-sm text-red-200">{errors.time}</p> : null}
              </label>
            </div>

            <label className="mt-6 block space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.18em] text-white/46">Special note</span>
                <span className="text-xs text-white/40">Optional</span>
              </div>
              <div className="flex items-start gap-3">
                <span className={cn(iconWrapClassName, "mt-0.5")}>
                  <NotebookPen className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <Textarea
                    value={values.notes}
                    onChange={(event) => handleFieldChange("notes", event.target.value)}
                    placeholder="Birthday table, terrace if possible…"
                    className={textAreaClassName(Boolean(errors.notes))}
                    maxLength={NOTES_LIMIT}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                {errors.notes ? <p className="text-sm text-red-200">{errors.notes}</p> : <span className="text-sm text-white/40">Any detail the floor team should know.</span>}
                <span className="text-xs text-white/38">{values.notes.length}/{NOTES_LIMIT}</span>
              </div>
            </label>
          </div>

          <div className="border-t border-white/10 bg-[#06101a]/92 px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-[20px] text-sm text-white/64">
                {submitError ? <p className="text-red-200">{submitError}</p> : <p>Only the essentials. Save it and keep moving.</p>}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting} className="rounded-2xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[180px] rounded-2xl bg-[#ffd24a] text-neutral-950 hover:bg-[#ffdc76]">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Reservation
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
