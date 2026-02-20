import type { RefObject } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { WrappedProgressDots } from "@/components/wrapped/WrappedProgressDots";
import { cn } from "@/lib/utils/cn";

export function WrappedControls({
  currentIndex,
  totalSlides,
  onPrev,
  onNext,
  onClose,
  onSelect,
  disabled,
  closeButtonRef
}: {
  currentIndex: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSelect: (index: number) => void;
  disabled?: boolean;
  closeButtonRef?: RefObject<HTMLButtonElement>;
}) {
  const buttonClass = cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70",
    "transition hover:text-white",
    disabled ? "pointer-events-none opacity-40" : ""
  );

  return (
    <div className="absolute right-6 top-5 z-20 flex items-center gap-3 text-white/70">
      <button
        type="button"
        onClick={onPrev}
        className={buttonClass}
        disabled={disabled || currentIndex === 0}
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onNext}
        className={buttonClass}
        disabled={disabled || currentIndex === totalSlides - 1}
        aria-label="Next slide"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <WrappedProgressDots
        count={totalSlides}
        activeIndex={currentIndex}
        onSelect={onSelect}
        disabled={disabled}
      />

      <span className="text-xs text-white/60">
        {currentIndex + 1}/{totalSlides}
      </span>

      <button
        type="button"
        onClick={onClose}
        ref={closeButtonRef}
        className={buttonClass}
        aria-label="Close wrapped modal"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
