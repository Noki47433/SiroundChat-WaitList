"use client";

import { useEffect, useRef, useState } from "react";

export function SafeChartContainer({
  children,
  className = "h-64",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setReady(true);
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={`w-full min-w-0 ${className}`}>
      {ready ? children : null}
    </div>
  );
}
