"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

type PhilosophySectionProps = {
  data: EvasionTemplateData["philosophy"];
};

export function PhilosophySection({ data }: PhilosophySectionProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [leftTranslateX, setLeftTranslateX] = useState(-100);
  const [rightTranslateX, setRightTranslateX] = useState(100);
  const [titleOpacity, setTitleOpacity] = useState(1);
  const rafRef = useRef<number | null>(null);

  const updateTransforms = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const sectionHeight = sectionRef.current.offsetHeight;
    const scrollableRange = sectionHeight - windowHeight;
    const scrolled = -rect.top;
    const progress = Math.max(0, Math.min(1, scrolled / scrollableRange));
    setLeftTranslateX((1 - progress) * -100);
    setRightTranslateX((1 - progress) * 100);
    setTitleOpacity(1 - progress);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateTransforms);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    updateTransforms();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateTransforms]);

  return (
    <section id="products" className="bg-[var(--evasion-bg)]">
      <div ref={sectionRef} className="relative" style={{ height: "200vh" }}>
        <div className="sticky top-0 flex h-screen items-center justify-center">
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center" style={{ opacity: titleOpacity }}>
              <h2 className="px-6 text-center text-[12vw] font-medium leading-[0.95] tracking-tighter text-[var(--evasion-text)] md:text-[10vw] lg:text-[8vw]">
                {data.heading}
              </h2>
            </div>

            <div className="relative z-10 grid grid-cols-1 gap-4 px-6 md:grid-cols-2 md:px-12 lg:px-20">
              {data.products.map((product, index) => (
                <div
                  key={product.name}
                  className="relative aspect-[4/3] overflow-hidden rounded-2xl"
                  style={{
                    transform: `translate3d(${index === 0 ? leftTranslateX : rightTranslateX}%, 0, 0)`,
                    backfaceVisibility: "hidden"
                  }}
                >
                  <Image
                    src={product.image.src}
                    alt={product.image.alt}
                    fill
                    className="object-cover"
                    unoptimized={isRemoteImage(product.image.src)}
                  />
                  <div className="absolute bottom-6 left-6">
                    <span
                      className="rounded-full px-4 py-2 text-sm font-medium backdrop-blur-md"
                      style={{
                        background: "var(--evasion-accent-soft)",
                        color: "var(--evasion-text)"
                      }}
                    >
                      {product.name} {product.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-14 pt-20 md:px-12 md:py-28 lg:px-20 lg:py-36">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs uppercase tracking-[0.35em] text-[var(--evasion-accent)]">
            First generation
          </p>
          <p className="mx-auto mt-8 max-w-4xl text-center text-2xl leading-relaxed text-[var(--evasion-text)] md:text-3xl">
            {data.description}
          </p>
          {data.paragraphs?.length ? (
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {data.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="rounded-[1.75rem] border px-5 py-5 text-base leading-relaxed text-[var(--evasion-muted)] md:px-6"
                  style={{
                    borderColor: "var(--evasion-border)",
                    background: "var(--evasion-surface)"
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
