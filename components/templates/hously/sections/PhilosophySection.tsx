"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { HighlightedText } from "@/components/templates/hously/HighlightedText";
import type { HouslyTemplateData } from "@/components/templates/hously/data";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

type PhilosophySectionProps = {
  data: HouslyTemplateData["philosophy"];
};

export function PhilosophySection({ data }: PhilosophySectionProps) {
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-index"));
          if (entry.isIntersecting) {
            setVisibleItems((prev) => [...new Set([...prev, index])]);
          }
        });
      },
      { threshold: 0.3 }
    );

    itemRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="about" className="py-32 md:py-28">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="mb-6 text-sm uppercase tracking-[0.3em] text-[var(--hously-muted)]">{data.sectionLabel}</p>
            <h2 className="mb-6 text-balance text-6xl font-medium leading-[1.15] tracking-tight lg:text-8xl">
              {data.title}
              <br />
              <HighlightedText>{data.accent}</HighlightedText>
            </h2>

            <div className="relative hidden lg:block">
              <Image
                src={data.image}
                alt={data.imageAlt}
                width={860}
                height={720}
                className="relative z-10 w-auto opacity-90"
                unoptimized={isRemoteImage(data.image)}
              />
            </div>
          </div>

          <div className="space-y-6 lg:pt-48">
            <p className="mb-12 max-w-md text-lg leading-relaxed text-[var(--hously-muted)]">{data.description}</p>

            {data.items.map((item, index) => (
              <div
                key={item.title}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                data-index={index}
                className={`transition-all duration-700 ${
                  visibleItems.includes(index) ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex gap-6">
                  <span className="text-sm font-medium text-[var(--site-text-faint)]">0{index + 1}</span>
                  <div>
                    <h3 className="mb-3 text-xl font-medium">{item.title}</h3>
                    <p className="leading-relaxed text-[var(--hously-muted)]">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
