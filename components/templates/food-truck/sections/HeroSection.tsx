import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Phone } from "lucide-react";
import styles from "@/components/templates/food-truck/food-truck.module.css";
import type { FoodTruckStat } from "@/components/templates/food-truck/data";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

interface HeroSectionProps {
  data: {
    titleTop: string;
    titleBottom: string;
    tagline: string;
    description: string;
    primaryCta: {
      label: string;
      href: string;
    };
    secondaryCta: {
      label: string;
      href: string;
    };
    schedule: {
      eyebrow: string;
      location: string;
      hours: string;
    };
    stats: FoodTruckStat[];
    heroImage: string;
  };
}

export function HeroSection({ data }: HeroSectionProps) {
  const heroUsesPhotoLayout = isRemoteImage(data.heroImage);

  return (
    <section
      id="hero"
      className={`${styles.scrollTarget} relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--ft-bg)] pt-20`}
    >
      <div
        className={`${styles.softGlow} absolute left-10 top-1/4 h-64 w-64 rounded-full`}
        style={{ background: "color-mix(in srgb, var(--ft-primary) 20%, transparent)" }}
      />
      <div
        className={`${styles.softGlow} absolute bottom-1/4 right-10 h-80 w-80 rounded-full`}
        style={{ background: "color-mix(in srgb, var(--ft-accent) 20%, transparent)" }}
      />
      <div
        className={`${styles.softGlow} absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full`}
        style={{ background: "color-mix(in srgb, var(--ft-primary) 10%, transparent)" }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="order-2 text-center md:order-1 md:text-left">
            <h1 className={`${styles.display} mb-4 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl`}>
              <span className="text-[var(--ft-primary)]">{data.titleTop}</span>
              <br />
              <span className="text-[var(--ft-text)]">{data.titleBottom}</span>
            </h1>

            <p className={`${styles.body} mx-auto mb-8 max-w-2xl text-xl font-light tracking-wide text-[var(--ft-muted)] sm:text-2xl md:mx-0 md:text-3xl`}>
              {data.tagline}
            </p>

            <p
              className={`${styles.body} mx-auto mb-10 max-w-xl text-base leading-relaxed sm:text-lg md:mx-0`}
              style={{ color: "color-mix(in srgb, var(--ft-text) 82%, transparent)" }}
            >
              {data.description}
            </p>

            <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row md:justify-start">
              <a
                href={data.primaryCta.href}
                data-editor-button="true"
                className={`${styles.display} group flex w-full items-center justify-center gap-3 rounded-lg px-8 py-4 text-sm font-black uppercase tracking-[0.16em] shadow-2xl transition-all hover:brightness-105 sm:w-auto`}
                style={{ background: "var(--ft-primary)", color: "var(--site-primary-foreground)" }}
              >
                <Phone className="h-5 w-5" />
                {data.primaryCta.label}
              </a>
              <Link
                href={data.secondaryCta.href}
                data-editor-button="true"
                className={`${styles.display} group flex w-full items-center justify-center gap-2 rounded-lg border-2 px-8 py-4 text-sm font-black uppercase tracking-[0.16em] text-[var(--ft-primary)] transition-all hover:bg-[var(--ft-primary)] hover:text-[var(--site-primary-foreground)] sm:w-auto`}
                style={{ borderColor: "var(--ft-primary)" }}
              >
                {data.secondaryCta.label}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className={`${styles.chip} mx-auto mb-16 max-w-xl rounded-2xl p-6 backdrop-blur-sm md:mx-0 md:p-8`}>
              <div className="text-left">
                <p className={`${styles.display} mb-1 text-2xl font-black uppercase tracking-[0.12em] text-[var(--ft-primary)] md:text-3xl`}>
                  {data.schedule.eyebrow}
                </p>
                <p className={`${styles.body} text-base font-bold text-[var(--ft-text)] md:text-lg`}>{data.schedule.location}</p>
                <p className={`${styles.body} mt-1 text-sm text-[var(--ft-muted)] md:text-base`}>{data.schedule.hours}</p>
              </div>
            </div>

            <div className="mx-auto grid max-w-lg grid-cols-3 gap-4 md:mx-0 md:gap-8">
              {data.stats.map((stat) => (
                <div key={stat.label} className="text-center md:text-left">
                  <p className={`${styles.display} text-2xl font-bold text-[var(--ft-primary)] sm:text-3xl md:text-4xl`}>{stat.value}</p>
                  <p className={`${styles.body} text-xs uppercase tracking-[0.16em] text-[var(--ft-muted)] sm:text-sm`}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div className="relative flex h-[400px] w-full items-center justify-center md:h-[600px]">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in srgb, var(--ft-primary) 18%, transparent), transparent 58%)"
                }}
              />
              <Image
                src={data.heroImage}
                alt="Signature burger"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className={`${styles.floaty} ${
                  heroUsesPhotoLayout
                    ? "rounded-[28px] object-cover drop-shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
                    : "object-contain"
                }`}
                style={
                  heroUsesPhotoLayout
                    ? undefined
                    : {
                        filter:
                          "drop-shadow(0 0 80px color-mix(in srgb, var(--ft-primary) 50%, transparent))"
                      }
                }
                unoptimized={isRemoteImage(data.heroImage)}
              />
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ArrowDown className="h-6 w-6 text-[var(--ft-primary)]" />
        </div>
      </div>
    </section>
  );
}
