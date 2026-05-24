import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import styles from "@/components/templates/food-truck/food-truck.module.css";

interface ContactSectionProps {
  data: {
    heading: string;
    description: string;
    phone: {
      label: string;
      value: string;
      href: string;
      help: string;
    };
    email: {
      label: string;
      value: string;
      href: string;
      help: string;
    };
    instagram: {
      label: string;
      value: string;
      href: string;
      help: string;
    };
    visitTitle: string;
    visitBody: string;
    visitNote: string;
  };
}

export function ContactSection({ data }: ContactSectionProps) {
  return (
    <section id="contact" className={`${styles.scrollTarget} bg-[var(--ft-surface)] py-20 md:py-32`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center md:mb-16">
          <h2 className={`${styles.display} mb-4 text-4xl font-bold tracking-tight text-[var(--ft-primary)] sm:text-5xl md:text-6xl`}>
            {data.heading}
          </h2>
          <p className={`${styles.body} mx-auto max-w-2xl text-lg text-[var(--ft-muted)]`}>{data.description}</p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          <article className="rounded-2xl border-2 bg-[var(--ft-surface-strong)] p-8 text-center transition-colors hover:border-[var(--ft-primary)]" style={{ borderColor: "var(--ft-border)" }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ft-primary)]">
              <Phone className="h-8 w-8 text-[var(--site-primary-foreground)]" />
            </div>
            <div>
              <p className={`${styles.body} mb-2 text-sm text-[var(--ft-muted)]`}>{data.phone.label}</p>
              <a href={data.phone.href} className={`${styles.display} text-2xl font-black text-[var(--ft-primary)] transition-colors hover:brightness-110 md:text-3xl`}>
                {data.phone.value}
              </a>
            </div>
            <p className={`${styles.body} mt-4 text-sm text-[var(--ft-muted)]`}>{data.phone.help}</p>
          </article>

          <article className="rounded-2xl border-2 bg-[var(--ft-surface-strong)] p-8 text-center transition-colors hover:border-[var(--ft-primary)]" style={{ borderColor: "var(--ft-border)" }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ft-primary)]">
              <Mail className="h-8 w-8 text-[var(--site-primary-foreground)]" />
            </div>
            <div>
              <p className={`${styles.body} mb-2 text-sm text-[var(--ft-muted)]`}>{data.email.label}</p>
              <a
                href={data.email.href}
                className={`${styles.display} text-lg font-bold text-[var(--ft-primary)] transition-colors hover:brightness-110 md:text-xl`}
              >
                {data.email.value}
              </a>
            </div>
            <p className={`${styles.body} mt-4 text-sm text-[var(--ft-muted)]`}>{data.email.help}</p>
          </article>

          <article className="rounded-2xl border-2 bg-[var(--ft-surface-strong)] p-8 text-center transition-colors hover:border-[var(--ft-primary)]" style={{ borderColor: "var(--ft-border)" }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ft-primary)]">
              <Instagram className="h-8 w-8 text-[var(--site-primary-foreground)]" />
            </div>
            <div>
              <p className={`${styles.body} mb-2 text-sm text-[var(--ft-muted)]`}>{data.instagram.label}</p>
              <a
                href={data.instagram.href}
                target="_blank"
                rel="noreferrer"
                className={`${styles.display} text-lg font-bold text-[var(--ft-primary)] transition-colors hover:brightness-110 md:text-xl`}
              >
                {data.instagram.value}
              </a>
            </div>
            <p className={`${styles.body} mt-4 text-sm text-[var(--ft-muted)]`}>{data.instagram.help}</p>
          </article>
        </div>

        <div className="mx-auto mt-12 max-w-2xl rounded-2xl border-2 p-8 text-center" style={{ borderColor: "color-mix(in srgb, var(--ft-primary) 30%, transparent)", background: "color-mix(in srgb, var(--ft-primary) 10%, transparent)" }}>
          <div className="mb-4 flex items-center justify-center gap-3">
            <MapPin className="h-6 w-6 text-[var(--ft-primary)]" />
            <h3 className={`${styles.display} text-2xl font-bold text-[var(--ft-text)]`}>{data.visitTitle}</h3>
          </div>
          <p className={`${styles.body} mb-2 text-lg text-[var(--ft-text)]`}>{data.visitBody}</p>
          <p className={`${styles.body} text-sm text-[var(--ft-muted)]`}>{data.visitNote}</p>
        </div>
      </div>
    </section>
  );
}
