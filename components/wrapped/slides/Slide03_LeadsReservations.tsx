"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { UnlockProgress } from "@/components/wrapped/slides/UnlockProgress";
import { useCountUp } from "@/components/wrapped/useCountUp";
import { LeadsReservationsBars } from "@/components/wrapped/visuals/LeadsReservationsBars";
import type { SlideProps } from "@/components/wrapped/slides/types";
import { cn } from "@/lib/utils/cn";

export function Slide03_LeadsReservations({ model, isShareMode, isActive, isDemo, visualAnimate }: SlideProps) {
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

  const confetti = isDemo ? (
    <div className="absolute inset-0">
      {[
        { left: "16%", top: "18%", rotation: -8, color: "bg-[var(--accent)]/60", delay: "0s" },
        { left: "24%", top: "30%", rotation: 14, color: "bg-[var(--glow)]/50", delay: "0.3s" },
        { left: "36%", top: "22%", rotation: -18, color: "bg-white/40", delay: "0.5s" },
        { left: "54%", top: "28%", rotation: 10, color: "bg-[var(--accent)]/50", delay: "0.2s" },
        { left: "68%", top: "20%", rotation: -12, color: "bg-[var(--glow)]/45", delay: "0.4s" },
        { left: "76%", top: "34%", rotation: 16, color: "bg-white/35", delay: "0.6s" }
      ].map((piece, index) => (
        <span
          key={index}
          className={`absolute h-2 w-1.5 rounded-sm ${piece.color} motion-safe:animate-[wrapped-float_7s_ease-in-out_infinite] motion-reduce:opacity-0`}
          style={{
            left: piece.left,
            top: piece.top,
            transform: `rotate(${piece.rotation}deg)`,
            animationDelay: piece.delay
          }}
        />
      ))}
    </div>
  ) : null;

  const underlay = (
    <>
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
        <div className="absolute inset-0">
          {Array.from({ length: 8 }).map((_, index) => (
            <span
              key={index}
              className="absolute h-1.5 w-1.5 rounded-full bg-white/30 motion-safe:animate-[wrapped-float_6s_ease-in-out_infinite] motion-reduce:opacity-0"
              style={{
                left: `${12 + index * 10}%`,
                top: `${24 + (index % 4) * 14}%`,
                animationDelay: `${index * 0.25}s`
              }}
            />
          ))}
        </div>
      </div>
      {confetti}
    </>
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

      <p className="text-sm font-semibold text-white/60">Close even 1 lead and this pays for itself.</p>

      {!hasCounts && !isDemo ? <UnlockProgress progress={model.unlockProgress} label="Opportunity unlock" /> : null}
    </WrappedSlideFrame>
  );
}
