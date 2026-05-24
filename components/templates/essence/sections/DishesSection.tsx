"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "@/components/templates/essence/essence.module.css";
import type { EssenceTemplateData } from "@/components/templates/essence/data";
import { ImageReveal } from "@/components/templates/essence/ImageReveal";

type DishesSectionProps = {
  data: EssenceTemplateData["dishes"];
};

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

export function DishesSection({ data }: DishesSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeDish, setActiveDish] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), { threshold: 0.1 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="dishes" className="relative overflow-hidden py-32 md:py-48" style={{ background: "var(--essence-secondary)" }}>
      <div className="mx-auto max-w-[1800px] px-6 md:px-12 lg:px-20">
        <div className="mb-20 grid gap-16 lg:grid-cols-12 lg:gap-20 md:mb-32">
          <div className="lg:col-span-2">
            <div
              className="flex items-center gap-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            >
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--essence-muted)]">(04)</span>
              <div className="h-px w-8 bg-[var(--essence-border)]" />
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--essence-muted)]">Signature Dishes</span>
            </div>
          </div>

          <div className="lg:col-span-10">
            <h2
              className={`${styles.serif} max-w-4xl text-pretty text-3xl font-light leading-[1.1] tracking-[-0.01em] text-[var(--essence-foreground)] sm:text-4xl md:text-5xl lg:text-6xl`}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(40px)",
                transitionProperty: "all",
                transitionDuration: "0.8s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: "0.1s"
              }}
            >
              {data.heading}
            </h2>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="relative lg:col-span-8">
            <div className="relative aspect-[4/3] overflow-hidden bg-[var(--essence-bg)]">
              {data.dishes.map((dish, index) => (
                <div key={dish.id} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: activeDish === index ? 1 : 0 }}>
                  {activeDish === index ? (
                    <ImageReveal src={dish.image} alt={dish.name} className="object-cover" sizes="(max-width: 768px) 100vw, 66vw" priority={index === 0} delay={300} />
                  ) : (
                    <Image
                      src={dish.image}
                      alt={dish.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 66vw"
                      priority={index === 0}
                      unoptimized={isRemoteImage(dish.image)}
                    />
                  )}
                </div>
              ))}

              <div
                className="absolute right-6 top-6 px-4 py-2 backdrop-blur-sm"
                style={{ background: "color-mix(in srgb, var(--site-surface) 90%, transparent)" }}
              >
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--essence-muted)]">{data.dishes[activeDish].season}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-4">
            {data.dishes.map((dish, index) => (
              <button
                key={dish.id}
                type="button"
                onClick={() => setActiveDish(index)}
                className={`w-full p-6 text-left transition-all duration-500 md:p-8 ${
                  activeDish === index ? "bg-[var(--essence-bg)]" : "hover:bg-[var(--site-surface-strong)]"
                }`}
                style={{
                  background:
                    activeDish === index
                      ? "var(--essence-bg)"
                      : "color-mix(in srgb, var(--site-surface) 82%, transparent)",
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(30px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: `${0.2 + index * 0.1}s`
                }}
              >
                <div className="space-y-4">
                  <div>
                    <h3 className={`${styles.serif} mb-1 text-2xl font-light text-[var(--essence-foreground)] md:text-3xl`}>{dish.name}</h3>
                    <p className="text-sm italic text-[var(--essence-muted)]">{dish.subtitle}</p>
                  </div>

                  <div
                    className="overflow-hidden transition-all duration-500"
                    style={{
                      maxHeight: activeDish === index ? "300px" : "0",
                      opacity: activeDish === index ? 1 : 0
                    }}
                  >
                    <div className="space-y-4 pt-2">
                      <p className="text-sm leading-relaxed text-[var(--site-text-soft)]">{dish.description}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="uppercase tracking-wider text-[var(--essence-muted)]">Technique:</span>
                        <span className="text-[var(--site-text-soft)]">{dish.technique}</span>
                      </div>
                      {dish.awards.length > 0 ? (
                        <div className="flex items-center gap-2 border-t pt-2" style={{ borderColor: "var(--essence-border)" }}>
                          <svg className="h-4 w-4 text-[var(--essence-accent)]" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-xs text-[var(--essence-accent)]">{dish.awards[0]}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-[var(--essence-border)]" />
                    <div className={`h-2 w-2 transition-all duration-500 ${activeDish === index ? "scale-125 bg-[var(--essence-accent)]" : "bg-[var(--essence-border)]"}`} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div
          className="mt-16 text-center md:mt-24"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            transitionProperty: "all",
            transitionDuration: "0.8s",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            transitionDelay: "0.6s"
          }}
        >
          <p className="mx-auto max-w-2xl text-sm italic leading-relaxed text-[var(--essence-muted)]">{data.note}</p>
        </div>
      </div>
    </section>
  );
}
