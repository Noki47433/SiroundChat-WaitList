"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Leaf, Users, UtensilsCrossed } from "lucide-react";

import { HighlightedText } from "@/components/templates/hously/HighlightedText";
import type { HouslyExperienceItem, HouslyTemplateData } from "@/components/templates/hously/data";
import styles from "@/components/templates/hously/hously.module.css";

type ExperienceSectionProps = {
  data: HouslyTemplateData["experience"];
};

function getIcon(icon: HouslyExperienceItem["icon"]) {
  switch (icon) {
    case "utensils":
      return UtensilsCrossed;
    case "calendar":
      return CalendarDays;
    case "users":
      return Users;
    case "leaf":
      return Leaf;
    default:
      return UtensilsCrossed;
  }
}

export function ExperienceSection({ data }: ExperienceSectionProps) {
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
      { threshold: 0.2 }
    );

    itemRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="experience" className="py-32 md:py-28">
      <div className="container mx-auto px-6 md:px-12">
        <div className="mb-20 max-w-3xl">
          <p className="mb-6 text-sm uppercase tracking-[0.3em] text-[var(--hously-muted)]">{data.sectionLabel}</p>
          <h2 className="mb-6 text-balance text-6xl font-medium leading-[1.15] tracking-tight lg:text-8xl">
            <HighlightedText>{data.title}</HighlightedText> {data.accent}
          </h2>
          <p className="text-lg leading-relaxed text-[var(--hously-muted)]">{data.description}</p>
        </div>

        <div className="grid gap-x-12 gap-y-16 md:grid-cols-2">
          {data.items.map((item, index) => {
            const Icon = getIcon(item.icon);
            return (
              <div
                key={item.title}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                data-index={index}
                className={`relative border-l pl-8 transition-all duration-700 ${
                  visibleItems.includes(index) ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
                style={{
                  borderColor: "var(--hously-border)",
                  transitionDelay: `${index * 150}ms`
                }}
              >
                <div
                  className={`transition-all duration-1000 ${visibleItems.includes(index) ? styles.drawStroke : ""}`}
                  style={{ transitionDelay: `${index * 150}ms` }}
                >
                  <Icon className="mb-4 h-10 w-10 text-[var(--hously-foreground)]" strokeWidth={1.25} />
                </div>
                <h3 className="mb-4 text-xl font-medium">{item.title}</h3>
                <p className="leading-relaxed text-[var(--hously-muted)]">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
