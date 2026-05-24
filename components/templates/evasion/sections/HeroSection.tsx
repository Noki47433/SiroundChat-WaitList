"use client";
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/templates/evasion/evasion.module.css";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

type HeroSectionProps = {
  data: EvasionTemplateData["hero"];
};

export function HeroSection({ data }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const scrollableHeight = window.innerHeight * 1.2;
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollableHeight));
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const textOpacity = Math.max(0, 1 - scrollProgress / 0.2);
  const imageProgress = Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.8));
  const centerWidth = 100 - imageProgress * 58;
  const centerHeight = 100 - imageProgress * 30;
  const sideWidth = imageProgress * 22;
  const sideOpacity = imageProgress;
  const sideTranslateLeft = -100 + imageProgress * 100;
  const sideTranslateRight = 100 - imageProgress * 100;
  const borderRadius = imageProgress * 24;
  const gap = imageProgress * 16;
  const sideTranslateY = -(imageProgress * 15);
  const leftImages = data.sideImages.filter((image) => image.position === "left");
  const rightImages = data.sideImages.filter((image) => image.position === "right");

  return (
    <section ref={sectionRef} id="top" className="relative bg-[var(--evasion-bg)]">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="relative flex h-full w-full items-stretch justify-center"
            style={{ gap: `${gap}px`, padding: `${imageProgress * 16}px`, paddingBottom: `${60 + imageProgress * 40}px` }}
          >
            <div
              className="flex flex-col will-change-transform"
              style={{
                width: `${sideWidth}%`,
                gap: `${gap}px`,
                transform: `translateX(${sideTranslateLeft}%) translateY(${sideTranslateY}%)`,
                opacity: sideOpacity
              }}
            >
              {leftImages.map((image) => (
                <div
                  key={image.src}
                  className="relative flex-1 overflow-hidden will-change-transform"
                  style={{ borderRadius: `${borderRadius}px` }}
                >
                  <img src={image.src} alt={image.alt} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>

            <div
              className="relative overflow-hidden will-change-transform"
              style={{
                width: `${centerWidth}%`,
                height: `${centerHeight}%`,
                flex: "0 0 auto",
                borderRadius: `${borderRadius}px`
              }}
            >
              <Image
                src={data.mainImage.src}
                alt={data.mainImage.alt}
                fill
                className="object-cover"
                priority
                unoptimized={isRemoteImage(data.mainImage.src)}
              />
              <div className="absolute inset-0 flex items-end overflow-hidden" style={{ opacity: textOpacity }}>
                <h1
                  className="w-full text-[18vw] font-medium leading-[0.78] tracking-tighter md:text-[14vw]"
                  style={{ color: "var(--site-primary-foreground, #ffffff)" }}
                >
                  {data.word.split("").map((letter, index) => (
                    <span
                      key={`${letter}-${index}`}
                      className={styles.heroLetter}
                      style={{
                        animationDelay: `${index * 0.08}s`,
                        transition: "all 1.5s",
                        transitionTimingFunction: "cubic-bezier(0.86, 0, 0.07, 1)"
                      }}
                    >
                      {letter}
                    </span>
                  ))}
                </h1>
              </div>
            </div>

            <div
              className="flex flex-col will-change-transform"
              style={{
                width: `${sideWidth}%`,
                gap: `${gap}px`,
                transform: `translateX(${sideTranslateRight}%) translateY(${sideTranslateY}%)`,
                opacity: sideOpacity
              }}
            >
              {rightImages.map((image) => (
                <div
                  key={image.src}
                  className="relative flex-1 overflow-hidden will-change-transform"
                  style={{ borderRadius: `${borderRadius}px` }}
                >
                  <img src={image.src} alt={image.alt} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="h-[80vh] lg:h-[96vh]" />

      <div className="px-6 pb-28 pt-32 md:px-12 md:pb-36 md:pt-48 lg:px-20 lg:pb-44 lg:pt-56">
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <span className="mb-8 h-px w-24 bg-[var(--evasion-accent)]" />
          <p className="text-center text-2xl leading-relaxed text-[var(--evasion-text)] md:text-3xl lg:text-[2.35rem] lg:leading-snug">
            {data.tagline}
          </p>
          {data.supportingLines?.length ? (
            <div className="mt-8 grid w-full gap-4 md:grid-cols-2">
              {data.supportingLines.map((line) => (
                <p
                  key={line}
                  className="rounded-[1.75rem] border px-5 py-5 text-left text-sm leading-relaxed text-[var(--evasion-text)] md:px-6"
                  style={{
                    borderColor: "var(--evasion-border)",
                    background: "var(--evasion-surface)"
                  }}
                >
                  {line}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
