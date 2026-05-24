"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/templates/essence/essence.module.css";
import type { EssenceTemplateData } from "@/components/templates/essence/data";
import { ImageReveal } from "@/components/templates/essence/ImageReveal";

type PhilosophySectionProps = {
  data: EssenceTemplateData["philosophy"];
};

export function PhilosophySection({ data }: PhilosophySectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), { threshold: 0.15 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="philosophy"
      className="relative overflow-hidden py-32 text-[var(--essence-primary-foreground)] md:py-48"
      style={{ background: "var(--site-surface-strong)" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
          {[["0", "200", "1920", "400", "0s"], ["0", "600", "1920", "300", "0.3s"], ["0", "900", "1920", "700", "0.6s"]].map(
            ([x1, y1, x2, y2, delay], index) => (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth="1"
                className="opacity-5"
                style={{
                  strokeDasharray: 2000,
                  strokeDashoffset: isVisible ? 0 : 2000,
                  transitionProperty: "stroke-dashoffset",
                  transitionDuration: index === 1 ? "2.5s" : "2s",
                  transitionTimingFunction: "ease-out",
                  transitionDelay: delay
                }}
              />
            )
          )}
        </svg>
      </div>

      <div className="relative mx-auto max-w-[1800px] px-6 md:px-12 lg:px-20">
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
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--site-text-soft)]">(02)</span>
              <div className="h-px w-8 bg-[var(--site-border)]" />
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--site-text-soft)]">Philosophy</span>
            </div>
          </div>

          <div className="lg:col-span-10">
            <div className="mb-20 md:mb-32">
              <h2
                className={`${styles.serif} max-w-3xl text-pretty text-3xl font-light leading-[1.1] tracking-[-0.01em] sm:text-4xl md:text-5xl lg:text-6xl`}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(40px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.1s"
                }}
              >
                {data.heading}
              </h2>
            </div>

            <div className="grid gap-x-16 gap-y-20 md:grid-cols-2">
              {data.principles.map((principle, index) => (
                <div
                  key={principle.number}
                  className="group"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(40px)",
                    transitionProperty: "all",
                    transitionDuration: "0.8s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: `${0.2 + index * 0.1}s`
                  }}
                >
                  <div className="flex items-start gap-6">
                    <span className={`${styles.mono} pt-1 text-xs tracking-wider text-[var(--site-text-faint)]`}>{principle.number}</span>
                    <div className="space-y-4">
                      <h3 className={`${styles.serif} text-2xl font-light text-[var(--essence-primary-foreground)] transition-colors duration-500 group-hover:text-[var(--essence-accent)] md:text-3xl`}>
                        {principle.title}
                      </h3>
                      <p className="text-base leading-relaxed text-[var(--site-text-soft)]">{principle.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="relative mt-32 md:mt-48"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(60px)",
            transitionProperty: "all",
            transitionDuration: "1s",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            transitionDelay: "0.6s"
          }}
        >
          <div className="relative aspect-[21/15.35] overflow-hidden">
            <ImageReveal src={data.image} alt={data.imageAlt} className="object-cover" sizes="(max-width: 1800px) 100vw, 1800px" delay={600} />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--site-surface-strong) 12%, transparent), color-mix(in srgb, var(--site-surface-strong) 55%, transparent))"
              }}
            />
          </div>
          <div className="absolute -bottom-8 right-0 px-6 py-4" style={{ background: "var(--site-surface)" }}>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--site-text-soft)]">{data.imageCaption}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
