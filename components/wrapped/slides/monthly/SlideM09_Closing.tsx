"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { SummarySparklines } from "@/components/wrapped/visuals/SummarySparklines";
import type { SlideProps } from "@/components/wrapped/slides/types";

export function SlideM09_Closing({
  model,
  isShareMode,
  onShare,
  onSecondaryCTA,
  onDone,
  isDemo,
  visualAnimate
}: SlideProps) {
  const reservationLabel = isDemo ? "Bookings (test drives / service)" : "Reservations";
  const miniStats = `Revenue: ${model.revenueLabel} · Leads: ${model.leads ?? "—"} · ${reservationLabel}: ${
    model.reservations ?? "—"
  } · Time saved: ${model.timeSavedMinutes !== null ? `${model.timeSavedMinutes}m` : "—"}`;

  const underlay = (
    <div className="absolute inset-0">
      <div
        className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 40% 40%, rgba(255,213,74,0.2), rgba(86,252,162,0.15) 50%, rgba(0,0,0,0) 75%)"
        }}
      />
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full bg-white/40 motion-safe:animate-[wrapped-float_7s_ease-in-out_infinite] motion-reduce:opacity-0"
          style={{
            left: `${10 + index * 7}%`,
            top: `${20 + (index % 5) * 12}%`,
            animationDelay: `${index * 0.4}s`
          }}
        />
      ))}
    </div>
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <h2 className="text-[46px] font-bold">🏁 Month wrapped, momentum loaded</h2>
      <p className="text-base text-white/70">Next month is ready to pop off.</p>
      <SummarySparklines animate={Boolean(visualAnimate)} />
      <p className="text-xs uppercase tracking-[0.25em] text-white/50">{miniStats}</p>

      {!isShareMode ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => onShare?.()}
            className="rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--glow)] px-6 py-2 text-sm font-semibold text-neutral-950 shadow-[0_10px_25px_rgba(255,213,74,0.2)] transition hover:brightness-105"
          >
            Share my AI Wrapped
          </button>
          <button
            type="button"
            onClick={() => onSecondaryCTA?.()}
            className="text-sm font-semibold text-white/70 hover:text-white"
          >
            Unlock deeper insights
          </button>
          <button
            type="button"
            onClick={() => onDone?.()}
            className="text-xs uppercase tracking-[0.3em] text-white/50 hover:text-white"
          >
            Done
          </button>
        </div>
      ) : null}
    </WrappedSlideFrame>
  );
}
