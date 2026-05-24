import Image from "next/image";
import { Flame } from "lucide-react";
import styles from "@/components/templates/food-truck/food-truck.module.css";
import type { FoodTruckMenuItem } from "@/components/templates/food-truck/data";
import { cn } from "@/lib/utils/cn";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

interface MenuCategoryProps {
  items: FoodTruckMenuItem[];
}

export function MenuCategory({ items }: MenuCategoryProps) {
  return (
    <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-16">
      {items.map((item) => {
        const spiceLevel = item.spiceLevel ?? 0;

        return (
          <article key={item.name} className="group relative">
            {item.image && (
              <div className="relative mb-6 aspect-square">
                <div className="absolute -right-4 -top-4 z-20 rounded-full px-6 py-3 shadow-2xl transition-transform duration-300 group-hover:scale-110" style={{ background: "var(--ft-primary)" }}>
                  <span className={`${styles.display} text-2xl font-black text-[var(--site-primary-foreground)] sm:text-3xl`}>{item.price}</span>
                </div>
                <div className="relative h-full w-full transition-transform duration-500 group-hover:-translate-y-2">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.4)] transition-all duration-500 group-hover:drop-shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    unoptimized={isRemoteImage(item.image)}
                  />
                </div>
              </div>
            )}

            <div className="px-2 text-center">
              <h3
                className={`${styles.display} mb-3 text-2xl font-black tracking-tight text-[var(--ft-text)] transition-colors group-hover:text-[var(--ft-primary)] lg:text-3xl`}
              >
                {item.name}
              </h3>
              <p className={cn(styles.body, styles.clampTwo, "mb-3 min-h-[3.5rem] text-sm leading-relaxed text-[var(--ft-muted)]")}>
                {item.description}
              </p>

              {spiceLevel > 0 && (
                <div className="mt-2 flex items-center justify-center gap-1">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Flame
                      key={`${item.name}-${index}`}
                      className={cn(
                        "h-5 w-5",
                        index < spiceLevel ? "fill-[var(--ft-accent)] text-[var(--ft-accent)]" : "text-[var(--site-text-faint)]"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
