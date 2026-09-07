"use client";

/**
 * The booking journey on a published website.
 *
 * Stage 3C proved this panel could show real availability and then handed the
 * visitor off to an enquiry form. That is not a booking. This is the complete
 * approved journey:
 *
 *   service → who → date → time → name + phone → confirm → success + manage link
 *
 * Four honesty rules this component exists to keep:
 *  · It shows no time until the canonical engine has returned one, and it
 *    computes nothing itself — every slot, every "who is free", every closed day
 *    comes from `/api/site-spec/booking`.
 *  · When the engine is unreachable it says so and offers a retry. It never
 *    falls back to a plausible-looking time.
 *  · Confirming calls the real booking write path. The slot the visitor is
 *    looking at is re-checked server-side at write time, so a page left open
 *    cannot book a time that has since gone.
 *  · A slot that is taken between display and confirm produces a clear "pick
 *    another" and refreshes the times — never a duplicate and never a silent
 *    failure.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

type Slot = { startAtIso: string; endAtIso: string };
type Worker = { id: string; name: string };

type Step = "idle" | "loading" | "choose" | "details" | "booking" | "done" | "error";

export type SiteSpecBookingPanelProps = {
  /** Published slug — how every request resolves the business. */
  slug: string | null;
  services: Array<{ id: string; name: string }>;
  ctaLabel: string;
  ctaHref: string;
  locale: string;
  classNames: {
    slots: string;
    slot: string;
    button: string;
    note: string;
    actions: string;
  };
};

const ANY = "any";

/** The next `count` dates from today, as local YYYY-MM-DD. */
const upcomingDates = (count: number): string[] => {
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return out;
};

const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `bk-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function SiteSpecBookingPanel({
  slug,
  services,
  ctaLabel,
  ctaHref,
  locale,
  classNames
}: SiteSpecBookingPanelProps) {
  const dates = useMemo(() => upcomingDates(14), []);

  const [step, setStep] = useState<Step>("idle");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [workerId, setWorkerId] = useState<string>(ANY);
  const [date, setDate] = useState(dates[0]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<
    { serviceName: string; startAt: string; manageUrl: string; status: string } | null
  >(null);
  /** One key per confirm attempt, so a double-click cannot become two bookings. */
  const [requestId, setRequestId] = useState(newRequestId);

  const load = useCallback(
    async (nextService: string, nextWorker: string, nextDate: string) => {
      if (!slug || !nextService) return;
      setStep("loading");
      setMessage(null);
      try {
        const params = new URLSearchParams({ slug, serviceId: nextService, date: nextDate });
        if (nextWorker !== ANY) params.set("teamMemberId", nextWorker);
        const response = await fetch(`/api/site-spec/booking?${params.toString()}`, {
          headers: { accept: "application/json" }
        });
        if (!response.ok) {
          setStep("error");
          return;
        }
        const data = (await response.json()) as {
          slots?: Slot[];
          timezone?: string | null;
          workers?: Worker[];
        };
        setSlots(data.slots ?? []);
        setWorkers(data.workers ?? []);
        setTimezone(data.timezone ?? null);
        setChosen(null);
        setStep("choose");
      } catch {
        setStep("error");
      }
    },
    [slug]
  );

  useEffect(() => {
    if (step === "idle") return;
    // Any change of service, provider or day re-asks the engine. Nothing is
    // carried over, because a slot only means something for one combination.
    void load(serviceId, workerId, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, workerId, date]);

  const formatTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone ?? undefined
      }).format(new Date(iso));
    } catch {
      return new Date(iso).toISOString().slice(11, 16);
    }
  };

  const formatDay = (value: string) => {
    try {
      const [y, m, d] = value.split("-").map(Number);
      return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(
        new Date(y, m - 1, d)
      );
    } catch {
      return value;
    }
  };

  const confirm = async () => {
    if (!slug || !chosen || !name.trim() || !phone.trim()) return;
    setStep("booking");
    setMessage(null);
    try {
      const response = await fetch("/api/site-spec/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          serviceId,
          teamMemberId: workerId === ANY ? null : workerId,
          date,
          startAt: chosen.startAtIso,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          requestId
        })
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.ok) {
        setConfirmed({
          serviceName: data.booking?.serviceName ?? "",
          startAt: data.booking?.startAt ?? chosen.startAtIso,
          manageUrl: data.manageUrl,
          status: data.booking?.status ?? "confirmed"
        });
        setStep("done");
        return;
      }

      // A slot taken between display and confirm is the expected race. Say so
      // plainly and put fresh times on screen rather than leaving a dead button.
      if (response.status === 409) {
        setMessage(data?.message ?? "That time isn't available any more. Please pick another.");
        setRequestId(newRequestId());
        await load(serviceId, workerId, date);
        return;
      }
      setMessage(data?.message ?? "We couldn't complete that booking just now. Please try again.");
      setStep("details");
    } catch {
      setMessage("We couldn't reach the booking system. Please try again.");
      setStep("details");
    }
  };

  // Without a published slug or a service there is nothing to ask, so the panel
  // is just its call to action — which is also correct in preview.
  if (!slug || !services.length) {
    return (
      <div className={classNames.actions}>
        <a className={classNames.button} href={ctaHref}>
          {ctaLabel}
        </a>
      </div>
    );
  }

  if (step === "done" && confirmed) {
    return (
      <div>
        <p className={classNames.note}>
          <strong>
            {confirmed.status === "pending" ? "Requested" : "Booked"} — {confirmed.serviceName},{" "}
            {formatDay(confirmed.startAt.slice(0, 10))} at {formatTime(confirmed.startAt)}
          </strong>
        </p>
        <p className={classNames.note}>
          {confirmed.status === "pending"
            ? "The business will confirm shortly. You can view or cancel it here:"
            : "Keep this link to view, change or cancel your booking:"}
        </p>
        <div className={classNames.actions}>
          <a className={classNames.button} href={confirmed.manageUrl}>
            Manage booking
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      {step === "idle" ? (
        <div className={classNames.actions}>
          <button
            type="button"
            className={classNames.button}
            onClick={() => void load(serviceId, workerId, date)}
          >
            {ctaLabel}
          </button>
        </div>
      ) : null}

      {step !== "idle" ? (
        <>
          {services.length > 1 ? (
            <div className={classNames.slots}>
              {services.slice(0, 6).map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className={classNames.slot}
                  aria-pressed={service.id === serviceId}
                  onClick={() => setServiceId(service.id)}
                >
                  {service.name}
                </button>
              ))}
            </div>
          ) : null}

          {workers.length > 1 ? (
            <div className={classNames.slots}>
              <button
                type="button"
                className={classNames.slot}
                aria-pressed={workerId === ANY}
                onClick={() => setWorkerId(ANY)}
              >
                Anyone
              </button>
              {workers.map((worker) => (
                <button
                  key={worker.id}
                  type="button"
                  className={classNames.slot}
                  aria-pressed={worker.id === workerId}
                  onClick={() => setWorkerId(worker.id)}
                >
                  {worker.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className={classNames.slots}>
            {dates.slice(0, 7).map((value) => (
              <button
                key={value}
                type="button"
                className={classNames.slot}
                aria-pressed={value === date}
                onClick={() => setDate(value)}
              >
                {formatDay(value)}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === "loading" ? <p className={classNames.note}>Checking times…</p> : null}

      {step === "error" ? (
        <>
          <p className={classNames.note}>We couldn&apos;t load times just now.</p>
          <div className={classNames.actions}>
            <button
              type="button"
              className={classNames.button}
              onClick={() => void load(serviceId, workerId, date)}
            >
              Try again
            </button>
          </div>
        </>
      ) : null}

      {(step === "choose" || step === "details" || step === "booking") && slots.length === 0 ? (
        <p className={classNames.note}>No times available on {formatDay(date)}. Try another day.</p>
      ) : null}

      {(step === "choose" || step === "details" || step === "booking") && slots.length > 0 ? (
        <div className={classNames.slots}>
          {slots.map((slot) => (
            <button
              key={slot.startAtIso}
              type="button"
              className={classNames.slot}
              aria-pressed={chosen?.startAtIso === slot.startAtIso}
              onClick={() => {
                setChosen(slot);
                setStep("details");
              }}
            >
              {formatTime(slot.startAtIso)}
            </button>
          ))}
        </div>
      ) : null}

      {message ? <p className={classNames.note}>{message}</p> : null}

      {(step === "details" || step === "booking") && chosen ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <p className={classNames.note}>
            {formatDay(date)} at {formatTime(chosen.startAtIso)}
            {timezone ? ` (${timezone})` : ""}
          </p>
          <div className={classNames.slots}>
            <input
              className={classNames.slot}
              name="name"
              placeholder="Full name"
              value={name}
              required
              onChange={(event) => setName(event.target.value)}
            />
            <input
              className={classNames.slot}
              name="phone"
              type="tel"
              placeholder="Phone"
              value={phone}
              required
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className={classNames.actions}>
            <button
              type="submit"
              className={classNames.button}
              disabled={step === "booking" || !name.trim() || !phone.trim()}
            >
              {step === "booking" ? "Confirming…" : "Confirm booking"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
