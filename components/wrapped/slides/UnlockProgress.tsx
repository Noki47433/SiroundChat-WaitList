import type { WrappedComputed } from "@/lib/wrapped/computeWrapped";

export function UnlockProgress({
  progress,
  label
}: {
  progress: WrappedComputed["unlockProgress"];
  label?: string;
}) {
  const total = Math.max(progress.chatsNeededForNextUnlock, 1);
  const ratio = Math.min(progress.chatsResolvedSoFar / total, 1);

  return (
    <div className="mt-4 w-full max-w-[320px]">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/50">
        <span>{label ?? "Unlock progress"}</span>
        <span>
          {progress.chatsResolvedSoFar}/{total} chats resolved
        </span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_rgba(255,213,74,0.4)]"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-white/50">Next unlock: {progress.nextUnlockLabel}</p>
    </div>
  );
}
