"use client";

/**
 * The booking panel's runtime boundary.
 *
 * The deterministic renderer draws this component's shell and nothing else — it
 * has no availability and must never imply one. Real times arrive here, at
 * runtime, from the existing SurroundChat booking engine through
 * `/api/site-spec/booking`.
 *
 * Three honesty rules this component exists to keep:
 *  · It shows no time until the engine has returned one.
 *  · When the engine is unreachable it says so and offers a retry. It never
 *    falls back to a plausible-looking time.
 *  · Choosing a time hands off to the existing booking channel. Website code
 *    does not create bookings.
 */
import { useCallback, useState } from "react";

type Slot = { startAtIso: string; endAtIso: string };

type Status = "idle" | "checking" | "slots" | "none" | "error";

export type SiteSpecBookingPanelProps = {
  /** Published slug — how the endpoint resolves the business. */
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

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function SiteSpecBookingPanel({
  slug,
  services,
  ctaLabel,
  ctaHref,
  locale,
  classNames
}: SiteSpecBookingPanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [timezone, setTimezone] = useState<string | null>(null);

  const check = useCallback(
    async (nextServiceId: string) => {
      if (!slug || !nextServiceId) return;
      setStatus("checking");
      try {
        const params = new URLSearchParams({ slug, serviceId: nextServiceId, date: todayISO() });
        const response = await fetch(`/api/site-spec/booking?${params.toString()}`, {
          headers: { accept: "application/json" }
        });
        if (!response.ok) {
          setStatus("error");
          return;
        }
        const data = (await response.json()) as { slots?: Slot[]; timezone?: string | null };
        const found = data.slots ?? [];
        setSlots(found);
        setTimezone(data.timezone ?? null);
        setStatus(found.length ? "slots" : "none");
      } catch {
        setStatus("error");
      }
    },
    [slug]
  );

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

  // Without a published slug there is nothing to ask, so the panel is just its
  // call to action — which is the correct behaviour in preview too.
  if (!slug || !services.length) {
    return (
      <div className={classNames.actions}>
        <a className={classNames.button} href={ctaHref}>
          {ctaLabel}
        </a>
      </div>
    );
  }

  return (
    <div>
      {services.length > 1 && status !== "idle" ? (
        <div className={classNames.slots}>
          {services.slice(0, 4).map((service) => (
            <button
              key={service.id}
              type="button"
              className={classNames.slot}
              aria-pressed={service.id === serviceId}
              onClick={() => {
                setServiceId(service.id);
                void check(service.id);
              }}
            >
              {service.name}
            </button>
          ))}
        </div>
      ) : null}

      {status === "idle" ? (
        <div className={classNames.actions}>
          <button type="button" className={classNames.button} onClick={() => void check(serviceId)}>
            See today&rsquo;s times
          </button>
          <a className={classNames.button} href={ctaHref}>
            {ctaLabel}
          </a>
        </div>
      ) : null}

      {status === "checking" ? <p className={classNames.note}>Checking the calendar&hellip;</p> : null}

      {status === "slots" ? (
        <>
          <div className={classNames.slots}>
            {slots.map((slot) => (
              <a key={slot.startAtIso} className={classNames.slot} href={ctaHref}>
                {formatTime(slot.startAtIso)}
              </a>
            ))}
          </div>
          <div className={classNames.actions}>
            <a className={classNames.button} href={ctaHref}>
              {ctaLabel}
            </a>
          </div>
        </>
      ) : null}

      {status === "none" ? (
        <>
          <p className={classNames.note}>Nothing left today — pick another day when you book.</p>
          <div className={classNames.actions}>
            <a className={classNames.button} href={ctaHref}>
              {ctaLabel}
            </a>
          </div>
        </>
      ) : null}

      {status === "error" ? (
        <>
          <p className={classNames.note} role="alert">
            Couldn&rsquo;t check the calendar just then.
          </p>
          <div className={classNames.actions}>
            <button type="button" className={classNames.button} onClick={() => void check(serviceId)}>
              Try again
            </button>
            <a className={classNames.button} href={ctaHref}>
              {ctaLabel}
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default SiteSpecBookingPanel;
