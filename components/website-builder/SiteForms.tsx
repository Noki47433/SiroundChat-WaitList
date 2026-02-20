"use client";

import { useState } from "react";
import { trackLeadSubmitted } from "@/lib/analytics/track";

type FormMode = "live" | "preview";

type FormBaseProps = {
  siteSlug?: string | null;
  siteId?: string | null;
  mode?: FormMode;
  analytics?: {
    businessId?: string;
    siteId?: string | null;
    pagePath?: string;
    pageTitle?: string | null;
    enabled?: boolean;
  };
};

const resolveSitePayload = (props: FormBaseProps) => {
  if (props.siteSlug) return { slug: props.siteSlug };
  if (props.siteId) return { siteId: props.siteId };
  return {};
};

const useFormStatus = () => {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  return { status, message, setStatus, setMessage };
};

export function ContactForm({ siteSlug, siteId, mode = "live", analytics }: FormBaseProps) {
  const { status, message, setStatus, setMessage } = useFormStatus();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode !== "live") return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const contact = String(formData.get("contact") ?? "").trim();
    const messageValue = String(formData.get("message") ?? "").trim();

    if (!name || !contact || !messageValue) {
      setStatus("error");
      setMessage("Please fill in all required fields.");
      return;
    }

    setStatus("sending");
    setMessage(null);

    const payload = {
      name,
      message: messageValue,
      email: contact.includes("@") ? contact : null,
      phone: contact.includes("@") ? null : contact
    };

    try {
      const response = await fetch("/api/site/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...resolveSitePayload({ siteSlug, siteId }),
          form_type: "contact",
          payload
        })
      });

      if (!response.ok) {
        throw new Error("Failed to submit");
      }

      setStatus("sent");
      setMessage("Thanks! We will be in touch shortly.");
      event.currentTarget.reset();
      if (analytics?.enabled !== false && analytics?.businessId) {
        const pagePath = analytics.pagePath ?? (typeof window !== "undefined" ? window.location.pathname : "/");
        const pageTitle = analytics.pageTitle ?? (typeof document !== "undefined" ? document.title : null);
        trackLeadSubmitted({
          businessId: analytics.businessId,
          siteId: analytics.siteId ?? null,
          pagePath,
          pageTitle,
          leadType: "form",
          referrer: typeof document !== "undefined" ? document.referrer || null : null
        });
      }
    } catch (error) {
      setStatus("error");
      setMessage("Submission failed. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Name
        <input
          name="name"
          placeholder="Your name"
          className="h-11 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 text-sm text-[color:var(--site-text)] placeholder:text-[color:var(--site-muted)]"
          disabled={status === "sending" || mode !== "live"}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Email or phone
        <input
          name="contact"
          placeholder="Email or phone"
          className="h-11 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 text-sm text-[color:var(--site-text)] placeholder:text-[color:var(--site-muted)]"
          disabled={status === "sending" || mode !== "live"}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Message
        <textarea
          name="message"
          rows={4}
          placeholder="How can we help?"
          className="rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 py-2 text-sm text-[color:var(--site-text)] placeholder:text-[color:var(--site-muted)]"
          disabled={status === "sending" || mode !== "live"}
          required
        />
      </label>
      <button
        type="submit"
        disabled={status === "sending" || mode !== "live"}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[color:var(--site-primary)] px-4 text-sm font-semibold text-[color:var(--site-buttonText)] disabled:opacity-60"
      >
        {status === "sending" ? "Sending..." : "Send message"}
      </button>
      {mode !== "live" ? <p className="text-xs text-muted">Preview only</p> : null}
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </form>
  );
}

export function ReservationForm({ siteSlug, siteId, mode = "live", analytics }: FormBaseProps) {
  const { status, message, setStatus, setMessage } = useFormStatus();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode !== "live") return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const date = String(formData.get("date") ?? "").trim();
    const time = String(formData.get("time") ?? "").trim();
    const contact = String(formData.get("contact") ?? "").trim();
    const partySize = String(formData.get("party_size") ?? "").trim();

    if (!name || !date || !time || !contact) {
      setStatus("error");
      setMessage("Please complete all required fields.");
      return;
    }

    setStatus("sending");
    setMessage(null);

    const payload = {
      name,
      date,
      time,
      email: contact.includes("@") ? contact : null,
      phone: contact.includes("@") ? null : contact,
      party_size: partySize || null
    };

    try {
      const response = await fetch("/api/site/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...resolveSitePayload({ siteSlug, siteId }),
          form_type: "reservation",
          payload
        })
      });

      if (!response.ok) {
        throw new Error("Failed to submit");
      }

      setStatus("sent");
      setMessage("Reservation request sent. We will confirm soon.");
      event.currentTarget.reset();

      if (analytics?.enabled !== false && analytics?.businessId) {
        const pagePath = analytics.pagePath ?? (typeof window !== "undefined" ? window.location.pathname : "/");
        const pageTitle = analytics.pageTitle ?? (typeof document !== "undefined" ? document.title : null);
        trackLeadSubmitted({
          businessId: analytics.businessId,
          siteId: analytics.siteId ?? null,
          pagePath,
          pageTitle,
          leadType: "form",
          referrer: typeof document !== "undefined" ? document.referrer || null : null
        });
      }
    } catch (error) {
      setStatus("error");
      setMessage("Submission failed. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Name
        <input
          name="name"
          placeholder="Your name"
          className="h-11 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 text-sm text-[color:var(--site-text)] placeholder:text-[color:var(--site-muted)]"
          disabled={status === "sending" || mode !== "live"}
          required
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Date
          <input
            name="date"
            type="date"
            className="h-11 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 text-sm text-[color:var(--site-text)]"
            disabled={status === "sending" || mode !== "live"}
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Time
          <input
            name="time"
            type="time"
            className="h-11 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 text-sm text-[color:var(--site-text)]"
            disabled={status === "sending" || mode !== "live"}
            required
          />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Phone or email
        <input
          name="contact"
          placeholder="Phone or email"
          className="h-11 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 text-sm text-[color:var(--site-text)] placeholder:text-[color:var(--site-muted)]"
          disabled={status === "sending" || mode !== "live"}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Party size (optional)
        <input
          name="party_size"
          placeholder="Optional"
          className="h-11 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 text-sm text-[color:var(--site-text)] placeholder:text-[color:var(--site-muted)]"
          disabled={status === "sending" || mode !== "live"}
        />
      </label>
      <button
        type="submit"
        disabled={status === "sending" || mode !== "live"}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[color:var(--site-primary)] px-4 text-sm font-semibold text-[color:var(--site-buttonText)] disabled:opacity-60"
      >
        {status === "sending" ? "Sending..." : "Request reservation"}
      </button>
      {mode !== "live" ? <p className="text-xs text-muted">Preview only</p> : null}
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </form>
  );
}
