"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";

type TechnologySectionProps = {
  data: EvasionTemplateData["technology"];
};

function ScrollRevealText({ text }: { text: string }) {
  const containerRef = useRef<HTMLParagraphElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const startOffset = windowHeight * 0.9;
      const endOffset = windowHeight * 0.1;
      const totalDistance = startOffset - endOffset;
      const currentPosition = startOffset - rect.top;
      setProgress(Math.max(0, Math.min(1, currentPosition / totalDistance)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const words = text.split(" ");

  return (
    <p ref={containerRef} className="text-3xl font-semibold leading-snug md:text-4xl lg:text-5xl">
      {words.map((word, index) => {
        const wordProgress = index / words.length;
        const isRevealed = progress > wordProgress;
        return (
          <span
            key={`${word}-${index}`}
            className="transition-colors duration-150"
            style={{ color: isRevealed ? "var(--evasion-text)" : "var(--site-text-faint)" }}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}

export function TechnologySection({ data }: TechnologySectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const scrollableHeight = window.innerHeight * 1.2;
      const scrolled = -rect.top;
      setScrollProgress(Math.max(0, Math.min(1, scrolled / scrollableHeight)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const imageProgress = Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.8));
  const centerWidth = 100 - imageProgress * 52;
  const sideWidth = imageProgress * 20;
  const sideOpacity = imageProgress;
  const sideTranslateLeft = -100 + imageProgress * 100;
  const sideTranslateRight = 100 - imageProgress * 100;
  const borderRadius = imageProgress * 24;
  const gap = imageProgress * 16;
  const leftImages = data.sideImages.filter((image) => image.position === "left");
  const rightImages = data.sideImages.filter((image) => image.position === "right");

  return (
    <section ref={sectionRef} className="bg-[var(--evasion-bg)]">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="flex h-full items-center justify-center">
          <div className="relative flex h-full w-full items-stretch justify-center px-6 lg:px-20" style={{ gap: `${gap}px`, paddingTop: "3rem", paddingBottom: "3rem" }}>
            <div
              className="flex flex-col will-change-transform"
              style={{
                width: `${sideWidth}%`,
                gap: `${gap}px`,
                transform: `translateX(${sideTranslateLeft}%)`,
                opacity: sideOpacity
              }}
            >
              {leftImages.map((image) => (
                <div key={image.src} className="relative flex-1 overflow-hidden" style={{ borderRadius: `${borderRadius}px` }}>
                  <img src={image.src} alt={image.alt} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>

            <div
              className="relative flex-1 overflow-hidden"
              style={{ width: `${centerWidth}%`, borderRadius: `${borderRadius}px` }}
            >
              <img src={data.centerImage.src} alt={data.centerImage.alt} className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-[var(--evasion-text)]/40" />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                <h2 className="max-w-3xl text-5xl font-medium leading-tight tracking-tight text-white md:text-5xl lg:text-7xl">
                  {data.titleWords.map((word, index) => {
                    const wordFadeStart = index * 0.07;
                    const wordFadeEnd = wordFadeStart + 0.07;
                    const wordProgress = Math.max(0, Math.min(1, (scrollProgress - wordFadeStart) / (wordFadeEnd - wordFadeStart)));
                    const wordOpacity = 1 - wordProgress;
                    const wordBlur = wordProgress * 10;
                    return (
                      <span
                        key={word}
                        className="inline-block"
                        style={{
                          opacity: wordOpacity,
                          filter: `blur(${wordBlur}px)`,
                          transition: "opacity 0.1s linear, filter 0.1s linear",
                          marginRight: index < data.titleWords.length - 1 ? "0.3em" : "0"
                        }}
                      >
                        {word}
                        {index === 1 ? <br /> : null}
                      </span>
                    );
                  })}
                </h2>
              </div>
            </div>

            <div
              className="flex flex-col will-change-transform"
              style={{
                width: `${sideWidth}%`,
                gap: `${gap}px`,
                transform: `translateX(${sideTranslateRight}%)`,
                opacity: sideOpacity
              }}
            >
              {rightImages.map((image) => (
                <div key={image.src} className="relative flex-1 overflow-hidden" style={{ borderRadius: `${borderRadius}px` }}>
                  <img src={image.src} alt={image.alt} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="h-[80vh] lg:h-[96vh]" />

      <div className="relative overflow-hidden bg-[var(--evasion-bg)] px-6 py-24 md:px-12 md:py-32 lg:px-20 lg:py-40">
        <div className="relative z-10 mx-auto max-w-5xl">
          <ScrollRevealText text={data.description} />
          {data.supportingItems?.length ? (
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {data.supportingItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.75rem] border px-5 py-5 md:px-6"
                  style={{
                    borderColor: "var(--evasion-border)",
                    background: "var(--evasion-surface)"
                  }}
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--evasion-accent)]">
                    {item.title}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--evasion-muted)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
