"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { UnlockProgress } from "@/components/wrapped/slides/UnlockProgress";
import { useCountUp } from "@/components/wrapped/useCountUp";
import { LeadsReservationsBars } from "@/components/wrapped/visuals/LeadsReservationsBars";
import type { SlideProps } from "@/components/wrapped/slides/types";
import { cn } from "@/lib/utils/cn";

export function SlideM03_LeadsReservations({ model, isShareMode, isActive, isDemo, visualAnimate }: SlideProps) {
  const hasCounts = model.leads !== null || model.reservations !== null || isDemo;
  const active = isActive ?? true;
  const allowAnimate = Boolean(visualAnimate);
  const rawLeads = model.leads ?? 0;
  const rawReservations = model.reservations ?? 0;
  const animatedLeads = useCountUp(active ? rawLeads : null, {
    enabled: allowAnimate
  });
  const animatedReservations = useCountUp(active ? rawReservations : null, {
    enabled: allowAnimate
  });

  const leadsValue = active && !allowAnimate ? rawLeads : Math.round(animatedLeads);
  const reservationsValue = active && !allowAnimate ? rawReservations : Math.round(animatedReservations);

  const delta = model.leadsDeltaPct ?? model.reservationsDeltaPct;
  const deltaLabel = delta !== null ? `${delta > 0 ? "+" : ""}${delta}% vs last month` : null;
  const deltaClass =
    delta === null
      ? "border-white/10 text-white/50"
      : delta >= 0
        ? "border-[var(--glow)]/50 text-[var(--glow)]"
        : "border-white/20 text-white/50";

  const underlay = (
    <div className="absolute inset-0 flex items-center justify-center opacity-40">
      <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-white/40">
        {[
          { label: "Visitors", active: true },
          { label: "Chats", active: true },
          { label: "Leads", active: (model.leads ?? 0) > 0 },
          { label: isDemo ? "Bookings" : "Reservations", active: (model.reservations ?? 0) > 0 }
        ].map((node, index, arr) => (
          <div key={node.label} className="flex items-center gap-3">
            <div
              className={cn(
                "h-3 w-3 rounded-full border",
                node.active ? "border-[var(--glow)]/70 bg-[var(--glow)]/30" : "border-white/20"
              )}
            />
            <span className="text-[10px]">{node.label}</span>
            {index < arr.length - 1 ? <span className="h-px w-8 bg-white/20" /> : null}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
        {isDemo ? "Leads + Bookings (test drives / service)" : "Leads + reservations captured"}
      </p>
      <p className="text-[72px] font-extrabold leading-none">
        {hasCounts
          ? `${leadsValue} leads · ${reservationsValue} ${isDemo ? "booking" : "reservation"}${reservationsValue === 1 ? "" : "s"}`
          : "—"}
      </p>

      <LeadsReservationsBars
        leads={leadsValue}
        reservations={reservationsValue}
        period={model.period}
        animate={Boolean(visualAnimate)}
        className="mt-2"
      />

      {deltaLabel ? (
        <span className={cn("rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]", deltaClass)}>
          {deltaLabel}
        </span>
      ) : null}

      {hasCounts ? (
        <div className="space-y-1 text-base text-white/70">
          <p>{isDemo ? "Your AI turned website chats into test drives and real leads." : "Your AI turned chats into customers."}</p>
          <p>That’s {leadsValue + reservationsValue} real opportunities captured — automatically.</p>
        </div>
      ) : (
        <div className="space-y-1 text-base text-white/70">
          <p>Your AI needs a few more captures to unlock this view.</p>
          <p>Keep it live — leads + reservations unlock fast.</p>
        </div>
      )}

      {!hasCounts && !isDemo ? <UnlockProgress progress={model.unlockProgress} label="Opportunity unlock" /> : null}
    </WrappedSlideFrame>
  );
}
