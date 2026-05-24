"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

import type { HouslyTemplateData } from "@/components/templates/hously/data";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

type HighlightsSectionProps = {
  data: HouslyTemplateData["highlights"];
};

export function HighlightsSection({ data }: HighlightsSectionProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [revealedImages, setRevealedImages] = useState<Set<number>>(new Set());
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = imageRefs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) {
              setRevealedImages((prev) => new Set(prev).add(data.items[index].id));
            }
          }
        });
      },
      { threshold: 0.2 }
    );

    imageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [data.items]);

  return (
    <section id="highlights" className="bg-[var(--hously-secondary)]/55 py-32 md:py-28">
      <div className="container mx-auto px-6 md:px-12">
        <div className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-6 text-sm uppercase tracking-[0.3em] text-[var(--hously-muted)]">{data.sectionLabel}</p>
            <h2 className="text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl">{data.title}</h2>
          </div>
          <a
            href={data.ctaHref}
            data-editor-button="true"
            className="group inline-flex items-center gap-2 text-sm text-[var(--hously-muted)] transition-colors hover:text-[var(--hously-foreground)]"
          >
            {data.ctaLabel}
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          {data.items.map((item, index) => (
            <article
              key={item.id}
              className="group cursor-pointer"
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                ref={(element) => {
                  imageRefs.current[index] = element;
                }}
                className="relative mb-6 aspect-[4/3] overflow-hidden"
                style={{ background: "var(--site-surface-strong)" }}
              >
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className={`object-cover transition-transform duration-700 ${
                    hoveredId === item.id ? "scale-105" : "scale-100"
                  }`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  unoptimized={isRemoteImage(item.image)}
                />
                {!isRemoteImage(item.image) ? (
                  <div
                    className="absolute inset-0 origin-top"
                    style={{
                      background:
                        "color-mix(in srgb, var(--site-surface-strong) 84%, var(--hously-accent) 16%)",
                      transform: revealedImages.has(item.id) ? "scaleY(0)" : "scaleY(1)",
                      transition: "transform 1.5s cubic-bezier(0.76, 0, 0.24, 1)"
                    }}
                  />
                ) : null}
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="mb-2 text-xl font-medium underline-offset-4 group-hover:underline">{item.title}</h3>
                  <p className="text-sm text-[var(--hously-muted)]">
                    {item.category} · {item.detail}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
