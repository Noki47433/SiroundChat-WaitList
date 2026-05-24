import { FadeImage } from "@/components/templates/evasion/FadeImage";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";

type FeaturedProductsSectionProps = {
  data: EvasionTemplateData["featuredProducts"];
};

export function FeaturedProductsSection({ data }: FeaturedProductsSectionProps) {
  return (
    <section id="technology" className="bg-[var(--evasion-bg)]">
      <div className="px-6 pb-20 pt-20 text-center md:px-12 md:py-28 lg:px-20 lg:pb-20 lg:pt-32">
        <h2 className="text-3xl font-medium tracking-tight text-[var(--evasion-text)] md:text-4xl lg:text-5xl">
          {data.title}
          <br />
          {data.subtitle}
        </h2>
        <p className="mx-auto mt-6 max-w-md text-sm text-[var(--evasion-muted)]">Technology</p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 pb-20 md:grid-cols-3 md:px-12 lg:px-20">
        {data.items.map((item) => (
          <div key={item.title} className="group">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
              <FadeImage src={item.image} alt={item.title} fill className="object-cover group-hover:scale-105" />
            </div>
            <div className="py-6">
              {item.eyebrow ? (
                <p className="mb-2 text-xs uppercase tracking-widest text-[var(--evasion-accent)]">{item.eyebrow}</p>
              ) : null}
              <h3 className="text-xl font-semibold text-[var(--evasion-text)]">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--evasion-muted)]">
                {item.detail ?? item.description}
              </p>
              {item.price ? (
                <p className="mt-4 text-xs uppercase tracking-[0.28em] text-[var(--evasion-accent)]">
                  {item.price}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
