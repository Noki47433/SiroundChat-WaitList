"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/templates/essence/essence.module.css";
import type { EssenceTemplateData } from "@/components/templates/essence/data";

type VisionSectionProps = {
  data: EssenceTemplateData["vision"];
};

export function VisionSection({ data }: VisionSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), { threshold: 0.2 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="vision" className="relative overflow-hidden py-32 md:py-48 lg:py-64">
      <div className="pointer-events-none absolute inset-0">
        <svg className="absolute left-0 top-0 h-full w-full opacity-[0.03]" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="essence-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#essence-grid)" />
        </svg>
      </div>

      <div className="mx-auto max-w-[1800px] px-6 md:px-12 lg:px-20">
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-2">
            <div
              className="flex items-center gap-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            >
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--essence-muted)]">(01)</span>
              <div className="h-px w-8 bg-[var(--essence-border)]" />
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--essence-muted)]">Vision</span>
            </div>
          </div>

          <div className="lg:col-span-10">
            <div className="space-y-16 md:space-y-24">
              <div className="overflow-hidden">
                <h2
                  className={`${styles.serif} max-w-5xl text-pretty text-3xl font-light leading-[1.1] tracking-[-0.01em] text-[var(--essence-foreground)] sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl`}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(60px)",
                    transitionProperty: "all",
                    transitionDuration: "1s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "0.1s"
                  }}
                >
                  {data.heading}
                </h2>
              </div>

              <div className="grid gap-12 md:grid-cols-2 md:gap-20">
                {data.paragraphs.map((paragraph, index) => (
                  <div
                    key={paragraph}
                    className="space-y-6"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateY(0)" : "translateY(40px)",
                      transitionProperty: "all",
                      transitionDuration: "0.8s",
                      transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                      transitionDelay: `${0.3 + index * 0.1}s`
                    }}
                  >
                    <p className="text-lg leading-relaxed text-[var(--site-text-soft)] md:text-xl">{paragraph}</p>
                  </div>
                ))}
              </div>

              <div
                className="grid grid-cols-2 gap-8 border-t pt-8 md:grid-cols-4 md:gap-12"
                style={{
                  borderColor: "var(--essence-border)",
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(30px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.5s"
                }}
              >
                {data.stats.map((stat) => (
                  <div key={stat.label} className="min-w-0 leading-5">
                    <span className="block max-w-[5ch] break-words text-4xl font-light leading-none tracking-tight text-[var(--essence-foreground)] lg:text-7xl">
                      {stat.value}
                    </span>
                    <p className="max-w-[14ch] pt-2 text-xs uppercase tracking-[0.15em] text-[var(--essence-muted)]">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
