import { cn } from "@/lib/utils/cn";

export function WrappedProgressDots({
  count,
  activeIndex,
  onSelect,
  disabled
}: {
  count: number;
  activeIndex: number;
  onSelect?: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: count }).map((_, index) => {
        const isActive = index === activeIndex;
        const dot = (
          <span
            className={cn(
              "h-2 w-2 rounded-full border border-white/15",
              isActive ? "bg-[var(--accent)] shadow-[0_0_10px_rgba(255,213,74,0.35)]" : "bg-white/10"
            )}
          />
        );
        if (!onSelect || disabled) {
          return <span key={index}>{dot}</span>;
        }
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            aria-label={`Go to slide ${index + 1}`}
            className="flex items-center justify-center"
          >
            {dot}
          </button>
        );
      })}
    </div>
  );
}
