"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "@/components/templates/essence/essence.module.css";
import type { EssenceTemplateData } from "@/components/templates/essence/data";
import { submitReservationRequest } from "@/components/templates/shared/reservation-submit";
import { useToast } from "@/components/ui/toast";

type ContactSectionProps = {
  data: EssenceTemplateData["contact"];
  siteId?: string | null;
};

export function ContactSection({ data, siteId }: ContactSectionProps) {
  const { push: pushToast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    time: "",
    guests: "2",
    message: ""
  });
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), {
      threshold: 0.1
    });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await submitReservationRequest({
        siteId,
        name: formState.name,
        email: formState.email || null,
        phone: formState.phone || null,
        date: formState.date,
        time: formState.time,
        partySize: formState.guests,
        notes: formState.message || null
      });

      pushToast({
        title: "Reservation request sent",
        message: "The request was saved and sent to the dashboard.",
        variant: "success"
      });

      setFormState({
        name: "",
        email: "",
        phone: "",
        date: "",
        time: "",
        guests: "2",
        message: ""
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit reservation request."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const baseFieldClass =
    "w-full border-0 border-b bg-transparent px-0 py-3 text-[var(--essence-foreground)] placeholder:text-[var(--site-text-faint)] focus:outline-none transition-colors duration-300";

  return (
    <section ref={sectionRef} id="contact" className="relative overflow-hidden py-32 md:py-48">
      <div className="pointer-events-none absolute inset-0">
        <svg className="absolute left-0 top-0 h-full w-full opacity-[0.02]" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="essence-contact-grid" width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="0.5" cy="0.5" r="0.5" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#essence-contact-grid)" />
        </svg>
      </div>

      <div className="mx-auto max-w-[1800px] px-6 md:px-12 lg:px-20">
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-2">
            <div
              className="flex items-center gap-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            >
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--essence-muted)]">(05)</span>
              <div className="h-px w-8 bg-[var(--essence-border)]" />
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--essence-muted)]">Reservations</span>
            </div>
          </div>

          <div className="lg:col-span-10">
            <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
              <div className="space-y-8">
                <h2
                  className={`${styles.serif} text-pretty text-3xl font-light leading-[1.1] tracking-[-0.01em] text-[var(--essence-foreground)] sm:text-4xl md:text-5xl lg:text-6xl`}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(40px)",
                    transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s"
                  }}
                >
                  {data.heading}
                </h2>

                <p
                  className="max-w-md text-lg leading-relaxed text-[var(--essence-muted)]"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(30px)",
                    transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s"
                  }}
                >
                  {data.description}
                </p>

                <div className="space-y-6 pt-8">
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">Restaurant</span>
                    <p className="text-[var(--essence-foreground)]">
                      {data.restaurantAddress[0]}
                      <br />
                      {data.restaurantAddress[1]}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">Reservations</span>
                    <p className="text-[var(--essence-foreground)]">
                      <a href={`mailto:${data.reservationEmail}`} className="transition-colors duration-300 hover:text-[var(--essence-accent)]">
                        {data.reservationEmail}
                      </a>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">Phone</span>
                    <p className="text-[var(--essence-foreground)]">
                      <a href={`tel:${data.phone.replace(/[^\d+]/g, "")}`} className="transition-colors duration-300 hover:text-[var(--essence-accent)]">
                        {data.phone}
                      </a>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">Hours</span>
                    <p className="text-[var(--essence-foreground)]">
                      {data.hours[0]}
                      <br />
                      {data.hours[1]}
                      <br />
                      <span className="text-sm text-[var(--essence-muted)]">{data.hours[2]}</span>
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-8"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(40px)",
                  transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s"
                }}
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="essence-name" className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">
                      {data.fields.nameLabel}
                    </label>
                    <input
                      id="essence-name"
                      type="text"
                      value={formState.name}
                      onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                      className={baseFieldClass}
                      style={{ borderColor: "var(--essence-border)" }}
                      placeholder={data.fields.placeholders.name}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="essence-email" className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">
                      {data.fields.emailLabel}
                    </label>
                    <input
                      id="essence-email"
                      type="email"
                      value={formState.email}
                      onChange={(event) => setFormState({ ...formState, email: event.target.value })}
                      className={baseFieldClass}
                      style={{ borderColor: "var(--essence-border)" }}
                      placeholder={data.fields.placeholders.email}
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="essence-phone" className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">
                      {data.fields.phoneLabel}
                    </label>
                    <input
                      id="essence-phone"
                      type="tel"
                      value={formState.phone}
                      onChange={(event) => setFormState({ ...formState, phone: event.target.value })}
                      className={baseFieldClass}
                      style={{ borderColor: "var(--essence-border)" }}
                      placeholder={data.fields.placeholders.phone}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="essence-guests" className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">
                      {data.fields.guestsLabel}
                    </label>
                    <input
                      id="essence-guests"
                      type="number"
                      min={1}
                      value={formState.guests}
                      onChange={(event) => setFormState({ ...formState, guests: event.target.value })}
                      className={baseFieldClass}
                      style={{ borderColor: "var(--essence-border)" }}
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="essence-date" className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">
                      {data.fields.dateLabel}
                    </label>
                    <input
                      id="essence-date"
                      type="date"
                      value={formState.date}
                      onChange={(event) => setFormState({ ...formState, date: event.target.value })}
                      className={baseFieldClass}
                      style={{ borderColor: "var(--essence-border)" }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="essence-time" className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">
                      Preferred Time
                    </label>
                    <input
                      id="essence-time"
                      type="time"
                      value={formState.time}
                      onChange={(event) => setFormState({ ...formState, time: event.target.value })}
                      className={baseFieldClass}
                      style={{ borderColor: "var(--essence-border)" }}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="essence-message" className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">
                    {data.fields.messageLabel}
                  </label>
                  <textarea
                    id="essence-message"
                    value={formState.message}
                    onChange={(event) => setFormState({ ...formState, message: event.target.value })}
                    rows={4}
                    className="w-full border border-[var(--essence-border)] bg-transparent px-4 py-3 text-[var(--essence-foreground)] outline-none placeholder:text-[var(--site-text-faint)]"
                    placeholder={data.fields.placeholders.message}
                  />
                </div>

                {error ? (
                  <div
                    className="rounded-xl border px-4 py-3 text-sm"
                    style={{
                      borderColor: "var(--site-border)",
                      background: "var(--site-accent-soft)",
                      color: "var(--essence-foreground)"
                    }}
                  >
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--essence-primary)] px-8 py-4 text-sm uppercase tracking-[0.18em] text-[var(--essence-primary-foreground)] transition hover:opacity-90 disabled:opacity-60"
                >
                  {isSubmitting ? "Sending..." : data.fields.submitLabel}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
