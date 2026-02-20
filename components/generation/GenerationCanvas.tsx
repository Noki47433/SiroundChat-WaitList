"use client";

type GenerationCanvasProps = {
  stepLabel: string;
  statusLabel: string;
  error?: string | null;
  onRetry?: () => void;
  personalLine?: string | null;
  templateLine?: string | null;
  progress?: number;
};

export function GenerationCanvas({
  stepLabel,
  statusLabel,
  error,
  onRetry,
  personalLine,
  templateLine,
  progress = 0
}: GenerationCanvasProps) {
  return (
    <div className="flex-1 overflow-hidden rounded-[28px] border border-[#e5e1d8] bg-white wix-soft-shadow">
      <div className="h-1 w-full bg-[#ece7df]">
        <div
          className="h-1 bg-gradient-to-r from-[#5b6bff] via-[#6f7bff] to-[#7c5cff]"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <div className="relative flex min-h-[520px] items-center justify-center bg-[#f7f5f1] px-6 py-10">
        <div className="pointer-events-none absolute inset-0 wix-grid opacity-60" />
        <div className="relative z-10 flex max-w-lg flex-col items-center gap-5 text-center">
          <div className="relative h-36 w-36">
            <span className="gen-orb-glow absolute inset-0 rounded-full" />
            <span className="gen-orb-core absolute inset-6 rounded-full" />
            <span className="gen-orb-ring absolute inset-2 rounded-full" />
            <span className="gen-orb-ring gen-orb-ring--slow absolute inset-6 rounded-full" />
            <span className="gen-orb-orbit gen-orb-orbit--one absolute inset-0">
              <span className="gen-orb-dot" />
            </span>
            <span className="gen-orb-orbit gen-orb-orbit--two absolute inset-0">
              <span className="gen-orb-dot gen-orb-dot--small" />
            </span>
            <span className="gen-orb-orbit gen-orb-orbit--three absolute inset-0">
              <span className="gen-orb-dot gen-orb-dot--tiny" />
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-semibold text-neutral-900">{stepLabel}</p>
            <p className="text-sm text-neutral-500">{statusLabel}</p>
            {personalLine ? (
              <p className="text-sm font-semibold text-neutral-800">{personalLine}</p>
            ) : null}
            {templateLine ? (
              <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-400">{templateLine}</p>
            ) : null}
          </div>
          {error ? (
            <div className="rounded-2xl bg-white px-4 py-3 text-xs text-neutral-500 shadow-sm">
              <p className="text-neutral-800">{error}</p>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
