"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import type { HouslyTemplateData } from "@/components/templates/hously/data";

type FaqSectionProps = {
  data: HouslyTemplateData["faq"];
};

export function FaqSection({ data }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="container mx-auto px-6 md:px-12">
        <div className="mb-16 max-w-3xl">
          <p className="mb-6 text-sm uppercase tracking-[0.3em] text-[var(--hously-muted)]">{data.sectionLabel}</p>
          <h2 className="text-balance text-6xl font-medium leading-[1.15] tracking-tight lg:text-7xl">{data.title}</h2>
        </div>

        <div>
          {data.items.map((item, index) => (
            <div key={item.question} className="border-b" style={{ borderColor: "var(--hously-border)" }}>
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="group flex w-full items-start justify-between gap-6 py-6 text-left"
              >
                <span className="text-lg font-medium text-[var(--hously-foreground)] transition-colors group-hover:text-[var(--hously-accent)]">
                  {item.question}
                </span>
                <Plus
                  className={`h-6 w-6 flex-shrink-0 text-[var(--hously-foreground)] transition-transform duration-300 ${
                    openIndex === index ? "rotate-45" : "rotate-0"
                  }`}
                  strokeWidth={1.5}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  openIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="pb-6 pr-12 leading-relaxed text-[var(--hously-muted)]">{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
