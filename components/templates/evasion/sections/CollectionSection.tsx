import styles from "@/components/templates/evasion/evasion.module.css";
import { FadeImage } from "@/components/templates/evasion/FadeImage";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";

type CollectionSectionProps = {
  data: EvasionTemplateData["accessories"];
};

export function CollectionSection({ data }: CollectionSectionProps) {
  return (
    <section id="accessories" className="bg-[var(--evasion-bg)]">
      <div className="px-6 py-20 md:px-12 md:py-10 lg:px-20">
        <h2 className="text-3xl font-medium tracking-tight text-[var(--evasion-text)] md:text-4xl">{data.title}</h2>
      </div>

      <div className="pb-24">
        <div className={`${styles.hideScrollbar} flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4 md:hidden`}>
          {data.items.map((item) => (
            <div key={item.title} className="group w-[75vw] flex-shrink-0 snap-center">
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--evasion-surface-2)]">
                <FadeImage src={item.image} alt={item.title} fill className="object-cover group-hover:scale-105" />
              </div>
              <div className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium leading-snug text-[var(--evasion-text)]">{item.title}</h3>
                    <p className="mt-2 text-sm text-[var(--evasion-muted)]">{item.description}</p>
                  </div>
                  <span className="text-lg font-medium text-[var(--evasion-text)]">{item.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden gap-8 px-12 md:grid md:grid-cols-3 lg:px-20">
          {data.items.map((item) => (
            <div key={item.title} className="group">
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--evasion-surface-2)]">
                <FadeImage src={item.image} alt={item.title} fill className="object-cover group-hover:scale-105" />
              </div>
              <div className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium leading-snug text-[var(--evasion-text)]">{item.title}</h3>
                    <p className="mt-2 text-sm text-[var(--evasion-muted)]">{item.description}</p>
                  </div>
                  <span className="text-2xl font-medium text-[var(--evasion-text)]">{item.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
