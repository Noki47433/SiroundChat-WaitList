"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CupSoda, Drumstick, Leaf, UtensilsCrossed } from "lucide-react";
import styles from "@/components/templates/food-truck/food-truck.module.css";
import { MenuCategory } from "@/components/templates/food-truck/MenuCategory";
import type {
  FoodTruckCategory,
  FoodTruckMenuFeature,
  FoodTruckMenuItem,
  FoodTruckMenuPromo
} from "@/components/templates/food-truck/data";
import { cn } from "@/lib/utils/cn";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

interface MenuSectionProps {
  data: {
    heading: string;
    subheading: string;
    promo: FoodTruckMenuPromo;
    categories: FoodTruckCategory[];
    items: Record<FoodTruckCategory["id"], FoodTruckMenuItem[]>;
    appetizers: FoodTruckMenuFeature[];
    crispyChicken: FoodTruckMenuFeature[];
  };
}

const categoryIcons = {
  burgers: UtensilsCrossed,
  chicken: Drumstick,
  veggie: Leaf,
  drinks: CupSoda
};

export function MenuSection({ data }: MenuSectionProps) {
  const [activeCategory, setActiveCategory] = useState<FoodTruckCategory["id"]>("burgers");
  const activeItems = useMemo(() => data.items[activeCategory], [activeCategory, data.items]);

  return (
    <section id="menu" className={`${styles.scrollTarget} bg-[var(--ft-surface)] py-20 md:py-32`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className={`${styles.display} mb-4 text-5xl font-black tracking-tight text-[var(--ft-primary)] sm:text-6xl md:text-7xl`}>
            {data.heading}
          </h2>
          <p
            className={`${styles.body} mx-auto max-w-3xl text-xl font-medium`}
            style={{ color: "color-mix(in srgb, var(--ft-text) 82%, transparent)" }}
          >
            {data.subheading}
          </p>
        </div>

        <div className="relative mb-16 overflow-hidden rounded-3xl border-4 p-8 text-center" style={{ borderColor: "var(--ft-primary)", background: "var(--ft-surface-strong)" }}>
          <div className="absolute inset-0 opacity-80" style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--ft-primary) 20%, transparent), color-mix(in srgb, var(--ft-primary) 10%, transparent), color-mix(in srgb, var(--ft-accent) 20%, transparent))" }} />
          <div className="relative">
            <p className={`${styles.display} mb-2 text-xl font-black uppercase tracking-[0.16em] text-[var(--ft-text)]`}>
              {data.promo.eyebrow}
            </p>
            <p className={`${styles.display} mb-2 text-3xl font-black tracking-tight text-[var(--ft-primary)] md:text-5xl`}>
              {data.promo.title}
            </p>
            <p className={`${styles.body} text-lg font-bold text-[var(--ft-text)] md:text-2xl`}>{data.promo.body}</p>
          </div>
        </div>

        <div className="mb-16 flex flex-wrap justify-center gap-3">
          {data.categories.map((category) => {
            const Icon = categoryIcons[category.id];
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  styles.display,
                  "group flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-black tracking-tight transition-all duration-300",
                  activeCategory === category.id
                    ? "scale-105 shadow-2xl"
                    : "border-2 bg-[var(--ft-surface-strong)] text-[var(--ft-text)] hover:scale-105"
                )}
                style={
                  activeCategory === category.id
                    ? { background: "var(--ft-primary)", color: "var(--site-primary-foreground)" }
                    : { borderColor: "var(--ft-border)" }
                }
              >
                <Icon className="h-6 w-6" />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>

        <MenuCategory items={activeItems} />

        <div className="mt-24 space-y-16">
          <div>
            <h3 className={`${styles.display} mb-12 text-center text-4xl font-black tracking-tight text-[var(--ft-primary)] md:text-5xl`}>
              APPETIZERS & SIDES
            </h3>
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {data.appetizers.map((item) => (
                <article key={item.name} className="group relative">
                  <div className="relative mb-4 aspect-square transition-transform duration-500 group-hover:-translate-y-2">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-contain drop-shadow-[0_15px_40px_rgba(0,0,0,0.3)] transition-all duration-500 group-hover:drop-shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
                      unoptimized={isRemoteImage(item.image)}
                    />
                  </div>
                  <div className="text-center">
                    <h4 className={`${styles.display} mb-2 text-xl font-black tracking-tight text-[var(--ft-text)] transition-colors group-hover:text-[var(--ft-primary)]`}>
                      {item.name}
                    </h4>
                    <p className={cn(styles.body, item.featured ? "text-2xl font-bold text-[var(--ft-primary)]" : "text-sm font-bold text-[var(--ft-primary)]")}>
                      {item.prices}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <h3 className={`${styles.display} mb-12 text-center text-4xl font-black tracking-tight text-[var(--ft-primary)] md:text-5xl`}>
              CRISPY CHICKEN
            </h3>
            <div className="grid gap-12 sm:grid-cols-2">
              {data.crispyChicken.map((item) => (
                <article key={item.name} className="group relative">
                  <div className="relative mb-6 aspect-video transition-transform duration-500 group-hover:-translate-y-2">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-500 group-hover:drop-shadow-[0_25px_70px_rgba(0,0,0,0.4)]"
                      unoptimized={isRemoteImage(item.image)}
                    />
                  </div>
                  <div className="text-center">
                    <h4 className={`${styles.display} mb-3 text-2xl font-black tracking-tight text-[var(--ft-text)] transition-colors group-hover:text-[var(--ft-primary)] lg:text-3xl`}>
                      {item.name}
                    </h4>
                    <p className={`${styles.body} text-lg font-bold text-[var(--ft-primary)]`}>{item.prices}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
