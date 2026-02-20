"use client";

import { useEffect, useRef, useState } from "react";

export const useCountUp = (
  value: number | null,
  {
    enabled = true,
    durationMs = 900
  }: {
    enabled?: boolean;
    durationMs?: number;
  } = {}
) => {
  const [display, setDisplay] = useState(value ?? 0);
  const hasAnimated = useRef(false);
  const lastValue = useRef<number | null>(value ?? null);

  useEffect(() => {
    if (value === null) {
      setDisplay(0);
      hasAnimated.current = false;
      lastValue.current = null;
      return;
    }

    if (!enabled || hasAnimated.current) {
      setDisplay(hasAnimated.current ? value : 0);
      if (hasAnimated.current) {
        lastValue.current = value;
      }
      return;
    }

    const start = performance.now();
    const from = lastValue.current ?? 0;
    const to = value;

    const tick = (now: number) => {
      const elapsed = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      const nextValue = from + (to - from) * eased;
      setDisplay(nextValue);
      if (elapsed < 1) {
        requestAnimationFrame(tick);
      } else {
        hasAnimated.current = true;
        lastValue.current = to;
      }
    };

    requestAnimationFrame(tick);
  }, [value, enabled, durationMs]);

  return display;
};
