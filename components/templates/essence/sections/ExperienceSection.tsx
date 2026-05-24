"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/templates/essence/essence.module.css";
import type { EssenceTemplateData } from "@/components/templates/essence/data";
import { ImageReveal } from "@/components/templates/essence/ImageReveal";

type ExperienceSectionProps = {
  data: EssenceTemplateData["experience"];
};

export function ExperienceSection({ data }: ExperienceSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), { threshold: 0.1 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="experience" className="relative overflow-hidden py-32 md:py-48">
      <div className="mx-auto max-w-[1800px] px-6 md:px-12 lg:px-20">
        <div className="grid lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-2">
            <div
              className="flex items-center gap-4 lg:sticky lg:top-32"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            >
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--essence-muted)]">(03)</span>
              <div className="h-px w-8 bg-[var(--essence-border)]" />
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--essence-muted)]">Experience</span>
            </div>
          </div>

          <div className="lg:col-span-10">
            <div className="mb-20 max-w-3xl md:mb-32">
              <h2
                className={`${styles.serif} mb-8 text-pretty text-3xl font-light leading-[1.1] tracking-[-0.01em] text-[var(--essence-foreground)] sm:text-4xl md:text-5xl lg:text-6xl`}
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
              <p
                className="text-lg leading-relaxed text-[var(--essence-muted)]"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(30px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.2s"
                }}
              >
                {data.description}
              </p>
            </div>

            <div
              className="relative mb-20 aspect-[16/9] overflow-hidden md:mb-32"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(40px)",
                transitionProperty: "all",
                transitionDuration: "0.8s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: "0.25s"
              }}
            >
              <ImageReveal src={data.image} alt={data.imageAlt} className="object-cover" sizes="(max-width: 1400px) 100vw, 1400px" delay={250} />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, var(--site-accent-soft), transparent)" }}
              />
            </div>

            <div className="space-y-0">
              {data.steps.map((step, index) => (
                <div
                  key={step.course}
                  className="group border-t"
                  style={{
                    borderColor: "var(--essence-border)",
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(30px)",
                    transitionProperty: "all",
                    transitionDuration: "0.8s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: `${0.3 + index * 0.1}s`
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveStep(activeStep === index ? -1 : index)}
                    className="w-full py-8 text-left md:py-12"
                    aria-expanded={activeStep === index}
                  >
                    <div className="grid items-start gap-4 md:grid-cols-12 md:gap-8">
                      <div className="flex items-center gap-4 md:col-span-3">
                        <span className={`${styles.mono} text-xs tracking-wider text-[var(--essence-muted)]`}>0{index + 1}</span>
                        <span className={`${styles.serif} text-xl text-[var(--essence-foreground)] transition-colors duration-300 group-hover:text-[var(--essence-accent)] md:text-2xl`}>
                          {step.course}
                        </span>
                      </div>
                      <div className="md:col-span-6">
                        <h3 className="text-lg text-[var(--site-text-soft)] transition-colors duration-300 group-hover:text-[var(--essence-foreground)] md:text-xl">
                          {step.title}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between md:col-span-3">
                        <span className="text-sm text-[var(--essence-muted)]">{step.timing}</span>
                        <div className="flex h-6 w-6 items-center justify-center">
                          <span className="text-lg text-[var(--essence-muted)] transition-transform duration-300" style={{ transform: activeStep === index ? "rotate(45deg)" : "rotate(0)" }}>
                            +
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  <div
                    className="overflow-hidden transition-all duration-500 ease-out"
                    style={{
                      maxHeight: activeStep === index ? "400px" : "0",
                      opacity: activeStep === index ? 1 : 0
                    }}
                  >
                    <div className="grid gap-8 pb-12 md:grid-cols-12 md:pb-16">
                      <div className="md:col-span-3" />
                      <div className="space-y-6 md:col-span-6">
                        <p className="leading-relaxed text-[var(--essence-muted)]">{step.description}</p>
                        <ul className="grid grid-cols-2 gap-3">
                          {step.details.map((detail) => (
                            <li key={detail} className="flex items-center gap-2 text-sm text-[var(--site-text-soft)]">
                              <span className="h-1 w-1 bg-[var(--essence-accent)]" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="border-t" style={{ borderColor: "var(--essence-border)" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
