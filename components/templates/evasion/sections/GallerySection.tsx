"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

type GallerySectionProps = {
  data: EvasionTemplateData["gallery"];
};

export function GallerySection({ data }: GallerySectionProps) {
  const galleryRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sectionHeight, setSectionHeight] = useState("100vh");
  const [translateX, setTranslateX] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const calculateHeight = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.scrollWidth;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const totalHeight = viewportHeight + Math.max(0, containerWidth - viewportWidth) * 0.55;
      setSectionHeight(`${totalHeight}px`);
    };

    const timer = window.setTimeout(calculateHeight, 100);
    window.addEventListener("resize", calculateHeight);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", calculateHeight);
    };
  }, []);

  const updateTransform = useCallback(() => {
    if (!galleryRef.current || !containerRef.current) return;
    const rect = galleryRef.current.getBoundingClientRect();
    const containerWidth = containerRef.current.scrollWidth;
    const viewportWidth = window.innerWidth;
    const totalScrollDistance = containerWidth - viewportWidth;
    const scrolled = Math.max(0, -rect.top);
    const progress = Math.min(1, scrolled / totalScrollDistance);
    setTranslateX(progress * -totalScrollDistance);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateTransform);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateTransform();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateTransform]);

  return (
    <section id="gallery" ref={galleryRef} className="relative bg-[var(--evasion-bg)]" style={{ height: sectionHeight }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="flex h-full items-center">
          <div
            ref={containerRef}
            className="flex gap-6 px-6"
            style={{
              transform: `translate3d(${translateX}px, 0, 0)`,
              backfaceVisibility: "hidden",
              perspective: 1000,
              touchAction: "pan-y"
            }}
          >
            {data.images.map((image, index) => (
              <div
                key={image.src}
                className="relative h-[70vh] w-[85vw] flex-shrink-0 overflow-hidden rounded-2xl md:w-[60vw] lg:w-[45vw]"
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  className="object-cover"
                  priority={index < 3}
                  unoptimized={isRemoteImage(image.src)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
