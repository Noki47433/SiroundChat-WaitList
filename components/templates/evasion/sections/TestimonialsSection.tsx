import Image from "next/image";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

type TestimonialsSectionProps = {
  data: EvasionTemplateData["testimonial"];
};

export function TestimonialsSection({ data }: TestimonialsSectionProps) {
  return (
    <section id="about" className="bg-[var(--evasion-bg)]">
      <div className="px-6 py-24 md:px-12 md:py-32 lg:px-20 lg:py-40">
        <span className="mb-6 block text-xs uppercase tracking-[0.35em] text-[var(--evasion-accent)]">
          Guest perspective
        </span>
        <p className="mx-auto max-w-5xl text-2xl leading-relaxed text-[var(--evasion-text)] md:text-3xl lg:text-[2.5rem] lg:leading-snug">
          {data.quote}
        </p>
      </div>

      <div className="relative aspect-[16/9] w-full">
        <Image src={data.image.src} alt={data.image.alt} fill className="object-cover" unoptimized={isRemoteImage(data.image.src)} />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--evasion-bg), color-mix(in srgb, var(--evasion-bg) 58%, transparent), transparent)"
          }}
        />
      </div>
    </section>
  );
}
