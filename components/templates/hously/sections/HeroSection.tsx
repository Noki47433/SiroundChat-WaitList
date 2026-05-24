"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown } from "lucide-react";

import type { HouslyTemplateData } from "@/components/templates/hously/data";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

type HeroSectionProps = {
  data: HouslyTemplateData["hero"];
};

export function HeroSection({ data }: HeroSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [animationComplete, setAnimationComplete] = useState(false);
  const accumulatedScrollRef = useRef(0);
  const lastTouchY = useRef(0);
  const usesPhotoHero = isRemoteImage(data.backgroundImage);
  const showForegroundOverlay =
    !usesPhotoHero &&
    data.foregroundImage &&
    data.foregroundImage !== data.backgroundImage;

  useEffect(() => {
    const applyTransform = (progress: number) => {
      if (!contentRef.current) return;
      const translateY = progress * 200;
      const rotationX = progress * 45;
      const scale = 1 - progress * 0.3;
      contentRef.current.style.transform = `translateY(${translateY}px) rotateX(${rotationX}deg) scale(${scale})`;
    };

    const handleProgress = (deltaY: number) => {
      accumulatedScrollRef.current = Math.max(0, Math.min(700, accumulatedScrollRef.current + deltaY));
      const progress = Math.max(0, Math.min(1, accumulatedScrollRef.current / 700));
      setAnimationComplete(progress >= 1);
      applyTransform(progress);
    };

    const handleWheel = (event: WheelEvent) => {
      const atTopOfPage = window.scrollY === 0;
      if (!atTopOfPage) return;
      if (!animationComplete || event.deltaY < 0) {
        event.preventDefault();
        handleProgress(event.deltaY);
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchY.current = event.touches[0].clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const atTopOfPage = window.scrollY === 0;
      const currentTouchY = event.touches[0].clientY;
      const deltaY = lastTouchY.current - currentTouchY;
      if (!atTopOfPage) {
        lastTouchY.current = currentTouchY;
        return;
      }
      if (!animationComplete || deltaY < 0) {
        event.preventDefault();
        handleProgress(deltaY * 3);
      }
      lastTouchY.current = currentTouchY;
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [animationComplete]);

  return (
    <section id="hero" className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src={data.backgroundImage}
          alt={data.backgroundAlt}
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
          unoptimized={isRemoteImage(data.backgroundImage)}
        />
      </div>

      {usesPhotoHero ? (
        <div
          className="absolute inset-0 z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, var(--site-overlay, rgba(8,10,14,0.52)) 55%, rgba(0,0,0,0.72) 100%)"
          }}
        />
      ) : null}

      <div
        ref={contentRef}
        className="container relative z-20 mx-auto px-1 pb-0 pt-8 md:px-12 md:pt-0 lg:pt-0"
        style={{
          willChange: "transform",
          transform: "translateY(0px)",
          perspective: "1000px",
          transformStyle: "preserve-3d"
        }}
      >
        <div className="mb-72 md:mb-60 lg:mb-80">
          <p className="mb-0 text-center text-sm uppercase tracking-[0.3em]" style={{ color: "color-mix(in srgb, var(--site-primary-foreground, #ffffff) 72%, var(--hously-primary) 28%)" }}>
            {data.eyebrow}
          </p>

          <h1
            className="mx-auto mb-0 max-w-[10ch] text-balance text-center text-6xl font-medium leading-[0.92] tracking-tight md:text-7xl lg:text-[6.5rem]"
            style={{ color: "var(--site-primary-foreground, #ffffff)" }}
          >
            {data.title}
            <br />
            <span style={{ color: "var(--hously-primary)" }}>{data.accentTitle}</span>
          </h1>
        </div>

        <div className="mx-auto max-w-xl text-center">
          <p
            className="text-lg leading-relaxed"
            style={{ color: "color-mix(in srgb, var(--site-primary-foreground, #ffffff) 84%, transparent)" }}
          >
            {data.description}
          </p>
        </div>
      </div>

      {showForegroundOverlay ? (
        <div className="pointer-events-none absolute inset-0 z-20">
          <Image
            src={data.foregroundImage}
            alt={data.foregroundAlt}
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
            unoptimized={isRemoteImage(data.foregroundImage)}
          />
        </div>
      ) : null}

      {animationComplete ? (
        <div className="absolute bottom-12 left-1/2 z-30 -translate-x-1/2 animate-bounce">
          <ArrowDown className="h-5 w-5" style={{ color: "color-mix(in srgb, var(--site-primary-foreground, #ffffff) 72%, transparent)" }} />
        </div>
      ) : null}
    </section>
  );
}
