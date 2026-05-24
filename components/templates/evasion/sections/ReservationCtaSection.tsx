"use client";

import type { EvasionTemplateData } from "@/components/templates/evasion/data";
import { ReservationRequestDialog } from "@/components/templates/shared/ReservationRequestDialog";

type ReservationCtaSectionProps = {
  data: EvasionTemplateData["reservation"];
  siteId?: string | null;
  brandName?: string;
  logoUrl?: string | null;
};

export function ReservationCtaSection({ data, siteId, brandName, logoUrl }: ReservationCtaSectionProps) {
  return (
    <section id="reserve" className="bg-[var(--evasion-bg)] px-6 py-24 md:px-12 lg:px-20">
      <div
        className="mx-auto max-w-6xl rounded-[2rem] px-6 py-10 shadow-[0_28px_90px_rgba(17,17,17,0.18)] md:px-10 md:py-14"
        style={{
          background: "var(--evasion-surface-2, var(--site-surface-strong))",
          color: "var(--evasion-text)",
          boxShadow: "var(--evasion-shadow)"
        }}
      >
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--evasion-muted)]">{data.eyebrow}</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-medium tracking-tight md:text-5xl">{data.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--evasion-muted)] md:text-lg">
              {data.description}
            </p>
          </div>
          <div className="flex items-start justify-start lg:justify-end">
            <ReservationRequestDialog
              siteId={siteId}
              title={data.title}
              description={data.description}
              submitLabel={data.buttonLabel}
              brandName={brandName}
              logoUrl={logoUrl}
              renderTrigger={({ open }) => (
                <button
                  type="button"
                  onClick={open}
                  className="inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-medium transition hover:opacity-90"
                  style={{
                    background: "var(--evasion-accent, #ffffff)",
                    color: "var(--site-primary-foreground, #111315)"
                  }}
                >
                  {data.buttonLabel}
                </button>
              )}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
