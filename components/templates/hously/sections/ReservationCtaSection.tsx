"use client";

import { ArrowRight } from "lucide-react";
import { HighlightedText } from "@/components/templates/hously/HighlightedText";
import type { HouslyTemplateData } from "@/components/templates/hously/data";
import { ReservationRequestDialog } from "@/components/templates/shared/ReservationRequestDialog";

type ReservationCtaSectionProps = {
  data: HouslyTemplateData["reservation"];
  siteId?: string | null;
  brandName?: string;
  logoUrl?: string | null;
};

export function ReservationCtaSection({ data, siteId, brandName, logoUrl }: ReservationCtaSectionProps) {
  return (
    <section
      id="contact"
      className="py-32 md:py-28"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--site-surface, #111315) 88%, transparent), var(--hously-foreground))",
        color: "var(--hously-primary-foreground)"
      }}
    >
      <div className="container mx-auto px-6 md:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <p
            className="mb-8 text-sm uppercase tracking-[0.3em]"
            style={{ color: "var(--site-text-soft)" }}
          >
            {data.sectionLabel}
          </p>

          <h2 className="mb-8 text-balance text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl lg:text-6xl">
            {data.title}
            <br />
            <HighlightedText>{data.accent}</HighlightedText>
          </h2>

          <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-[var(--site-text-soft)] md:text-xl">
            {data.description}
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <ReservationRequestDialog
              siteId={siteId}
              title={data.title}
              description={data.description}
              submitLabel={data.primaryLabel}
              brandName={brandName}
              logoUrl={logoUrl}
              renderTrigger={({ open }) => (
                <button
                  type="button"
                  onClick={open}
                  className="group inline-flex items-center justify-center gap-3 px-8 py-4 text-sm tracking-wide transition duration-300 hover:brightness-105"
                  style={{
                    background: "var(--hously-primary)",
                    color: "var(--hously-primary-foreground)"
                  }}
                >
                  {data.primaryLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              )}
            />
            <a
              href={data.secondaryHref}
              className="inline-flex items-center justify-center gap-2 border px-8 py-4 text-sm tracking-wide transition-colors duration-300 hover:bg-white/5"
              style={{
                borderColor: "color-mix(in srgb, var(--hously-primary) 45%, transparent)",
                color: "var(--site-primary-foreground, #ffffff)"
              }}
            >
              {data.secondaryLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
