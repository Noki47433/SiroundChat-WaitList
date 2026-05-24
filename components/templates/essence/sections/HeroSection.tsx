"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/templates/essence/essence.module.css";
import type { EssenceTemplateData } from "@/components/templates/essence/data";
import { ImageReveal } from "@/components/templates/essence/ImageReveal";

type HeroSectionProps = {
  data: EssenceTemplateData["hero"];
};

export function HeroSection({ data }: HeroSectionProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsLoaded(true);
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      if (rect.bottom > 0) setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section ref={sectionRef} id="top" className="relative flex min-h-screen items-end overflow-hidden">
      <div className="absolute inset-0 z-0" style={{ transform: `translateY(${scrollY * 0.3}px)` }}>
        <ImageReveal
          src={data.heroImage}
          alt={data.heroAlt}
          priority
          className="object-cover object-center"
          sizes="100vw"
          delay={300}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--essence-bg), color-mix(in srgb, var(--essence-bg) 55%, transparent), transparent)"
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, color-mix(in srgb, var(--site-accent-soft) 75%, transparent), transparent, transparent)"
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        <div className="absolute left-[10%] top-0 h-full w-px bg-[var(--site-border)]" style={{ transform: `translateY(${-scrollY * 0.1}px)` }} />
        <div className="absolute left-[30%] top-0 h-full w-px bg-[var(--site-border)]" style={{ transform: `translateY(${-scrollY * 0.15}px)` }} />
        <div className="absolute right-[20%] top-0 h-full w-px bg-[var(--site-border)]" style={{ transform: `translateY(${-scrollY * 0.08}px)` }} />
        <div className="absolute left-0 top-[40%] h-px w-full bg-[var(--site-border)]" style={{ transform: `translateX(${scrollY * 0.05}px)` }} />
      </div>

      <div className="relative z-20 mx-auto w-full max-w-[1800px] px-6 pb-16 md:px-12 md:pb-24 lg:px-20 lg:pb-32">
        <div className="grid items-end gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-8">
            <div className="max-w-[11ch] overflow-hidden lg:max-w-[9ch]">
              <h1
                className={`${styles.serif} text-5xl font-light leading-[0.9] tracking-[-0.02em] text-[var(--essence-foreground)] sm:text-6xl md:text-7xl lg:text-[5.6rem] xl:text-[7.2rem]`}
                style={{
                  transform: isLoaded ? "translateY(0)" : "translateY(100%)",
                  opacity: isLoaded ? 1 : 0,
                  transitionProperty: "all",
                  transitionDuration: "1s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.3s"
                }}
              >
                <span className="block text-balance">{data.headline[0]}</span>
                <span className="block text-balance">{data.headline[1]}</span>
                <span className="block text-balance italic text-[var(--essence-accent)]">{data.headline[2]}</span>
              </h1>
            </div>
          </div>

          <div className="lg:col-span-4 lg:pb-4">
            <div
              className="space-y-6"
              style={{
                transform: isLoaded ? "translateY(0)" : "translateY(40px)",
                opacity: isLoaded ? 1 : 0,
                transitionProperty: "all",
                transitionDuration: "0.8s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: "0.6s"
              }}
            >
              <div className="flex items-center gap-4">
                <div className="h-px w-12" style={{ background: "var(--essence-accent)" }} />
                <span className="text-xs uppercase tracking-[0.3em] text-[var(--essence-muted)]">{data.eyebrow}</span>
              </div>
              <p className="max-w-md text-base leading-relaxed text-[var(--essence-muted)] md:text-lg">{data.description}</p>
              <div className="pt-2">
                <a
                  href={data.ctaHref}
                  data-editor-button="true"
                  className="inline-flex items-center gap-3 text-sm uppercase tracking-[0.1em] text-[var(--essence-foreground)]"
                >
                  <span
                    className="px-3 py-3"
                    style={{
                      background: "var(--essence-primary)",
                      color: "var(--essence-primary-foreground)"
                    }}
                  >
                    {data.ctaLabel}
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 lg:flex"
          style={{
            opacity: isLoaded ? 1 : 0,
            transitionProperty: "opacity",
            transitionDuration: "1s",
            transitionTimingFunction: "ease",
            transitionDelay: "1.2s"
          }}
        >
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">Scroll</span>
          <div
            className="relative h-12 w-px overflow-hidden"
            style={{ background: "linear-gradient(to bottom, var(--site-text-soft), transparent)" }}
          >
            <div className="absolute inset-0 w-full bg-[var(--essence-accent)]" style={{ animation: "essence-scroll-pulse 2s ease-in-out infinite" }} />
          </div>
        </div>
      </div>

      <div
        className="absolute right-6 top-32 z-20 hidden md:block md:right-12 lg:right-20"
        style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? "translateX(0)" : "translateX(20px)",
          transitionProperty: "all",
          transitionDuration: "0.8s",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          transitionDelay: "0.9s"
        }}
      >
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">
          <span>{data.coordinates[0]}</span>
          <div className="h-px w-8 bg-[var(--essence-border)]" />
          <span>{data.coordinates[1]}</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes essence-scroll-pulse {
          0%,
          100% {
            transform: translateY(-100%);
          }
          50% {
            transform: translateY(100%);
          }
        }
      `}</style>
    </section>
  );
}
