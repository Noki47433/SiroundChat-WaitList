"use client";

import styles from "@/components/templates/food-truck/food-truck.module.css";
import { ReservationRequestDialog } from "@/components/templates/shared/ReservationRequestDialog";

interface ReservationCtaSectionProps {
  data: {
    heading: string;
    description: string;
    buttonLabel: string;
    buttonHref: string;
  };
  siteId?: string | null;
  brandName?: string;
  logoUrl?: string | null;
}

export function ReservationCtaSection({ data, siteId, brandName, logoUrl }: ReservationCtaSectionProps) {
  return (
    <section id="reservations" className={`${styles.scrollTarget} bg-[var(--ft-bg)] py-10 md:py-14`}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border p-6 text-center shadow-[0_18px_40px_rgba(0,0,0,0.25)] md:p-8" style={{ borderColor: "color-mix(in srgb, var(--ft-primary) 20%, transparent)", background: "var(--ft-surface-strong)" }}>
          <h2 className={`${styles.display} mb-3 text-2xl font-bold tracking-tight text-[var(--ft-primary)] md:text-3xl`}>
            {data.heading}
          </h2>
          <p className={`${styles.body} mx-auto mb-5 max-w-2xl text-sm leading-relaxed text-[var(--ft-muted)] md:text-base`}>
            {data.description}
          </p>
          <ReservationRequestDialog
            siteId={siteId}
            title={data.heading}
            description={data.description}
            submitLabel={data.buttonLabel}
            brandName={brandName}
            logoUrl={logoUrl}
            renderTrigger={({ open }) => (
              <button
                type="button"
                onClick={open}
                className={`${styles.display} inline-flex rounded-lg px-6 py-3 text-sm font-black uppercase tracking-[0.14em] transition-colors hover:brightness-105`}
                style={{ background: "var(--ft-primary)", color: "var(--site-primary-foreground)" }}
              >
                {data.buttonLabel}
              </button>
            )}
          />
        </div>
      </div>
    </section>
  );
}
