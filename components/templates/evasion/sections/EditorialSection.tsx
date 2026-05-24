import Image from "next/image";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";

type EditorialSectionProps = {
  data: EvasionTemplateData["editorial"];
};

const isVideoSource = (value: string) => /\.(mp4|webm|ogg)(\?.*)?$/i.test(value);
const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

export function EditorialSection({ data }: EditorialSectionProps) {
  return (
    <section className="bg-[var(--evasion-bg)]">
      {data.intro ? (
        <div className="mx-auto max-w-4xl px-6 pb-16 pt-8 text-center md:px-12 lg:px-20">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--evasion-accent)]">
            Editorial notes
          </p>
          <p className="mt-6 text-lg leading-relaxed text-[var(--evasion-muted)] md:text-xl">
            {data.intro}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 border-t border-[var(--evasion-border)] md:grid-cols-4">
        {data.specs.slice(0, 4).map((spec) => (
          <div
            key={spec.label}
            className="border-b border-r border-[var(--evasion-border)] p-8 text-center last:border-r-0 md:border-b-0"
          >
            <p className="mb-2 break-words text-xs uppercase tracking-widest text-[var(--evasion-muted)]">{spec.label}</p>
            <p className="mx-auto max-w-[10ch] break-words text-3xl font-medium leading-tight text-[var(--evasion-text)] md:text-4xl">
              {spec.value}
            </p>
          </div>
        ))}
      </div>

      <div className="relative aspect-[16/9] w-full md:aspect-[21/9]">
        {isVideoSource(data.videoUrl) ? (
          <video autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" src={data.videoUrl} />
        ) : (
          <Image
            src={data.videoUrl}
            alt="Restaurant ambiance"
            fill
            className="object-cover"
            unoptimized={isRemoteImage(data.videoUrl)}
          />
        )}
      </div>
    </section>
  );
}
