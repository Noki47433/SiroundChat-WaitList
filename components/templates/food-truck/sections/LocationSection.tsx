import Image from "next/image";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import styles from "@/components/templates/food-truck/food-truck.module.css";

const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

interface LocationSectionProps {
  data: {
    heading: string;
    description: string;
    mapImage: string;
    addressTitle: string;
    addressLines: string[];
    calendarTitle: string;
    calendarBody: string;
    hoursTitle: string;
    hoursBody: string;
    eventsTitle: string;
    eventsBody: string;
  };
}

export function LocationSection({ data }: LocationSectionProps) {
  return (
    <section id="location" className={`${styles.scrollTarget} bg-[var(--ft-bg)] py-20 md:py-32`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center md:mb-16">
          <div className="mb-6 flex items-center justify-center gap-4">
            <MapPin className="h-10 w-10 text-[var(--ft-primary)]" />
            <h2 className={`${styles.display} text-4xl font-bold tracking-tight text-[var(--ft-primary)] sm:text-5xl md:text-6xl`}>
              {data.heading}
            </h2>
            <MapPin className="h-10 w-10 text-[var(--ft-primary)]" />
          </div>
          <p className={`${styles.body} mx-auto max-w-2xl text-lg text-[var(--ft-muted)]`}>{data.description}</p>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-[var(--ft-surface-strong)] lg:aspect-square">
            <Image
              src={data.mapImage}
              alt="Location map"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              unoptimized={isRemoteImage(data.mapImage)}
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                <div
                  className="absolute -inset-4 animate-ping rounded-full"
                  style={{ background: "color-mix(in srgb, var(--ft-accent) 30%, transparent)" }}
                />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ft-accent)]">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className={`${styles.surface} rounded-2xl p-8`}>
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--ft-accent)]">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className={`${styles.display} mb-2 text-2xl font-bold text-[var(--ft-text)]`}>{data.addressTitle}</h3>
                  <p className={`${styles.body} text-lg text-[var(--ft-muted)]`}>
                    {data.addressLines.map((line) => (
                      <span key={line}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </p>
                </div>
              </div>

              <div className="mb-6 flex items-start gap-4">
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: "color-mix(in srgb, var(--ft-primary) 20%, transparent)" }}
                >
                  <CalendarDays className="h-6 w-6 text-[var(--ft-primary)]" />
                </div>
                <div>
                  <h3 className={`${styles.display} mb-2 text-xl font-bold text-[var(--ft-text)]`}>{data.calendarTitle}</h3>
                  <p className={`${styles.body} text-[var(--ft-muted)]`}>{data.calendarBody}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: "color-mix(in srgb, var(--ft-primary) 20%, transparent)" }}
                >
                  <Clock3 className="h-6 w-6 text-[var(--ft-primary)]" />
                </div>
                <div>
                  <h3 className={`${styles.display} mb-2 text-xl font-bold text-[var(--ft-text)]`}>{data.hoursTitle}</h3>
                  <p className={`${styles.body} text-[var(--ft-muted)]`}>{data.hoursBody}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-6" style={{ borderColor: "color-mix(in srgb, var(--ft-primary) 30%, transparent)", background: "color-mix(in srgb, var(--ft-primary) 10%, transparent)" }}>
              <h4 className={`${styles.display} mb-2 text-xl font-bold text-[var(--ft-primary)]`}>{data.eventsTitle}</h4>
              <p className={`${styles.body} text-[var(--ft-text)]`}>{data.eventsBody}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
