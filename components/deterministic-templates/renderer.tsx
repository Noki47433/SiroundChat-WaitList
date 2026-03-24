import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type {
  DentalPayload,
  DeterministicPayload,
  RealEstatePayload,
  RestaurantPayload,
  ServicePayload
} from "@/lib/deterministic-templates/schemas";

const layout = {
  section: "py-10 md:py-16",
  dentalSection: "py-12 md:py-20",
  container: "mx-auto max-w-6xl px-4 sm:px-6",
  formMax: "max-w-xl",
  gridGap: "gap-4 md:gap-6",
  headingSpacing: "mb-6",
  paragraphSpacing: "mb-4",
  listSpacing: "space-y-2"
} as const;

const ratioToDimensions = (ratio: string) => {
  const [w, h] = ratio.split(":").map((value) => Number(value));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: 1600, height: 900 };
  }
  return { width: w * 200, height: h * 200 };
};

const ImageWithFallback = ({
  src,
  alt,
  ratio,
  fallbackLabel
}: {
  src: string;
  alt: string;
  ratio: string;
  fallbackLabel: string;
}) => {
  if (!src || !src.trim()) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-700 to-neutral-500 text-center text-white"
        style={{ aspectRatio: ratio.replace(":", " / ") }}
      >
        <div className="px-6 py-10">
          <p className="text-sm uppercase tracking-widest">Asset missing</p>
          <p className="mt-2 text-lg font-semibold">{fallbackLabel}</p>
        </div>
      </div>
    );
  }

  const { width, height } = ratioToDimensions(ratio);

  return (
    <div className="w-full overflow-hidden rounded-2xl" style={{ aspectRatio: ratio.replace(":", " / ") }}>
      <Image src={src} alt={alt} width={width} height={height} className="h-full w-full object-cover" />
    </div>
  );
};

const CtaLink = ({ href, label, secondary = false }: { href: string; label: string; secondary?: boolean }) => {
  return (
    <a href={href}>
      <Button
        type="button"
        variant={secondary ? "outline" : "primary"}
        className={secondary ? "h-11 rounded-xl border-neutral-300 text-neutral-900" : "h-11 rounded-xl bg-neutral-900 text-white"}
      >
        {label}
      </Button>
    </a>
  );
};

const StandardsFallback = ({ bullets }: { bullets: string[] }) => {
  return (
    <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
      <h3 className="text-xl font-semibold text-neutral-900">Standards / What to expect</h3>
      <ul className={`mt-4 list-disc pl-6 text-sm text-neutral-700 ${layout.listSpacing}`}>
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </Card>
  );
};

const GalleryPlaceholderCards = () => {
  return (
    <div className={`grid sm:grid-cols-3 ${layout.gridGap}`}>
      {[1, 2, 3].map((index) => (
        <Card
          key={index}
          className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-700 shadow-none"
        >
          Add photos to unlock gallery.
        </Card>
      ))}
    </div>
  );
};

export const DeterministicRestaurantTemplate = ({ payload }: { payload: RestaurantPayload }) => {
  return (
    <main className="bg-stone-50 text-neutral-900">
      <header className="border-b border-neutral-200 py-4">
        <div className={`${layout.container} flex flex-wrap items-center justify-between ${layout.gridGap}`}>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
            {payload.header.nav_items.map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-neutral-800">
                {item}
              </a>
            ))}
          </nav>
          <CtaLink href={payload.header.primary_cta_url} label={payload.header.primary_cta_label} />
        </div>
      </header>

      <section id="hero" className={layout.section}>
        <div className={`${layout.container} grid items-center md:grid-cols-2 ${layout.gridGap}`}>
          <div>
            <h1 className={`${layout.headingSpacing} font-serif text-4xl leading-tight text-neutral-900`}>{payload.hero.headline}</h1>
            <p className={`${layout.paragraphSpacing} font-sans text-base text-neutral-700`}>{payload.hero.subhead}</p>
            <div className="flex flex-wrap gap-4">
              <CtaLink href={payload.hero.primary_cta_url} label={payload.hero.primary_cta_label} />
              <CtaLink href={payload.hero.secondary_cta_url} label={payload.hero.secondary_cta_label} secondary />
            </div>
          </div>
          <ImageWithFallback
            src={payload.hero.hero_image.src}
            alt={payload.hero.hero_image.alt}
            ratio={payload.hero.hero_image.crop_desktop}
            fallbackLabel="Hero image unavailable"
          />
        </div>
      </section>

      <section id="proof" className="py-10">
        <div className={layout.container}>
          <div className={`grid sm:grid-cols-3 ${layout.gridGap}`}>
            {payload.proof.items.map((item) => (
              <Card key={item} className="rounded-2xl border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-700 shadow-none">
                {item}
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="signature" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>Signature highlights</h2>
          <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
            {payload.signature.items.map((item) => (
              <Card key={`${item.title}-${item.desc}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                <ImageWithFallback
                  src={item.image.src}
                  alt={item.image.alt}
                  ratio={item.image.crop}
                  fallbackLabel="Dish photo unavailable"
                />
                <h3 className="mt-4 font-serif text-xl">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-700">{item.desc}</p>
                {item.price ? <p className="mt-3 text-sm font-semibold text-neutral-900">{item.price}</p> : null}
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="menu" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>Menu</h2>
          <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
            <p className="text-sm text-neutral-700">
              {payload.menu.variant === "pdf"
                ? "PDF menu with top sellers"
                : "Menu categories with featured items"}
            </p>
            <div className="mt-4">
              <CtaLink href={payload.menu.menu_url} label="View menu" secondary />
            </div>
          </Card>
        </div>
      </section>

      <section id="story" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>Atmosphere & story</h2>
          <p className="max-w-3xl font-sans text-base text-neutral-700">{payload.story.paragraph}</p>
        </div>
      </section>

      <section id="logistics" className={layout.section}>
        <div className={`${layout.container} grid md:grid-cols-2 ${layout.gridGap}`}>
          <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
            <h3 className="font-serif text-xl">Hours & location</h3>
            <p className="mt-3 text-sm text-neutral-700">{payload.logistics.address}</p>
            <p className="mt-3 text-sm font-semibold">{payload.logistics.phone}</p>
            <ul className={`mt-4 text-sm text-neutral-700 ${layout.listSpacing}`}>
              {payload.logistics.hours.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Card>
          <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
            <h3 className="font-serif text-xl">Policies</h3>
            <ul className={`mt-4 list-disc pl-6 text-sm text-neutral-700 ${layout.listSpacing}`}>
              {payload.logistics.policies.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {payload.logistics.map_url ? (
              <a className="mt-4 inline-block text-sm font-semibold text-neutral-900 underline" href={payload.logistics.map_url}>
                Open map
              </a>
            ) : null}
          </Card>
        </div>
      </section>

      <section id="reviews" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>Reviews</h2>
          {payload.reviews.items.length === 0 ? (
            <StandardsFallback
              bullets={[
                "Booking confirmations are immediate.",
                "Allergen support available on request.",
                "Walk-ins accepted based on capacity."
              ]}
            />
          ) : (
            <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
              {payload.reviews.items.map((item) => (
                <Card key={`${item.name}-${item.quote}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                  <p className="text-sm text-neutral-700">&ldquo;{item.quote}&rdquo;</p>
                  <p className="mt-4 text-sm font-semibold text-neutral-900">{item.name}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="newsletter" className={layout.section}>
        <div className={`${layout.container} ${layout.formMax}`}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>{payload.newsletter.headline}</h2>
          <p className={`${layout.paragraphSpacing} text-sm text-neutral-700`}>{payload.newsletter.subhead}</p>
          <div className={`grid ${layout.gridGap}`}>
            <input
              className="h-11 rounded-xl border border-neutral-300 px-4 text-sm"
              type="email"
              placeholder="Email"
              aria-label="Email"
            />
            <Button type="button" className="h-11 rounded-xl bg-neutral-900 text-white">
              Subscribe
            </Button>
          </div>
        </div>
      </section>

      <footer id="footer" className="border-t border-neutral-200 py-10">
        <div className={`${layout.container} ${layout.listSpacing}`}>
          <p className="text-sm text-neutral-700">{payload.footer.email}</p>
          <a href={payload.footer.instagram_url} className="text-sm font-semibold text-neutral-900 underline">
            Instagram
          </a>
          {payload.footer.micro_legal ? <p className="text-xs text-neutral-600">{payload.footer.micro_legal}</p> : null}
        </div>
      </footer>
    </main>
  );
};

export const DeterministicDentalTemplate = ({ payload }: { payload: DentalPayload }) => {
  const hasReviews = payload.reviews.items.length > 0;

  return (
    <main className="bg-emerald-50 text-neutral-900">
      <header className="border-b border-neutral-200 py-4">
        <div className={`${layout.container} flex flex-wrap items-center justify-between ${layout.gridGap}`}>
          <div>
            <p className="text-sm font-semibold text-neutral-900">{payload.header.phone}</p>
            <p className="text-xs text-neutral-600">{payload.header.location}</p>
          </div>
          <CtaLink href={payload.header.primary_cta_url} label={payload.header.primary_cta_label} />
        </div>
      </header>

      <section id="hero" className={layout.dentalSection}>
        <div className={`${layout.container} grid items-center md:grid-cols-2 ${layout.gridGap}`}>
          <div>
            <h1 className={`${layout.headingSpacing} text-4xl font-semibold leading-tight`}>{payload.hero.headline}</h1>
            <p className={`${layout.paragraphSpacing} text-base text-neutral-700`}>{payload.hero.subhead}</p>
            <div className="flex flex-wrap gap-4">
              <CtaLink href={payload.hero.primary_cta_url} label={payload.hero.primary_cta_label} />
              <CtaLink href={payload.hero.secondary_cta_url} label={payload.hero.secondary_cta_label} secondary />
            </div>
          </div>
          <ImageWithFallback
            src={payload.hero.hero_image.src}
            alt={payload.hero.hero_image.alt}
            ratio={payload.hero.hero_image.crop_desktop}
            fallbackLabel="Clinic hero image unavailable"
          />
        </div>
      </section>

      <section id="trust" className={layout.dentalSection}>
        <div className={layout.container}>
          <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
            <h2 className="text-2xl font-semibold">Trust</h2>
            {payload.trust.rating_label ? <p className="mt-2 text-sm text-neutral-700">{payload.trust.rating_label}</p> : null}
            <ul className={`mt-4 list-disc pl-6 text-sm text-neutral-700 ${layout.listSpacing}`}>
              {payload.trust.differentiators.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section id="services" className={layout.dentalSection}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>Services</h2>
          <div className={`grid md:grid-cols-2 ${layout.gridGap}`}>
            {payload.services.categories.map((service) => (
              <Card key={`${service.title}-${service.description}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                <h3 className="text-xl font-semibold">{service.title}</h3>
                <p className="mt-2 text-sm text-neutral-700">{service.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="why_us" className={layout.dentalSection}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>Why us</h2>
          <ul className={`list-disc pl-6 text-sm text-neutral-700 ${layout.listSpacing}`}>
            {payload.why_us.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="team" className={layout.dentalSection}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>Team</h2>
          <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
            {payload.team.providers.map((member) => (
              <Card key={member.name} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                <ImageWithFallback
                  src={member.image.src}
                  alt={member.image.alt}
                  ratio={member.image.crop}
                  fallbackLabel="Team image unavailable"
                />
                <h3 className="mt-4 text-lg font-semibold">{member.name}</h3>
                <p className="mt-1 text-xs text-neutral-600">{member.credentials}</p>
                <p className="mt-2 text-sm text-neutral-700">{member.bio}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className={layout.dentalSection}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>
            {payload.pricing.variant === "insurance_list" ? "Insurance" : "Pricing bands"}
          </h2>
          <div className={`grid md:grid-cols-2 ${layout.gridGap}`}>
            {payload.pricing.items.map((item) => (
              <Card key={`${item.title}-${item.detail}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-700">{item.detail}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="reviews" className={layout.dentalSection}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>Reviews</h2>
          {hasReviews ? (
            <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
              {payload.reviews.items.map((item) => (
                <Card key={`${item.name}-${item.quote}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                  <p className="text-sm text-neutral-700">&ldquo;{item.quote}&rdquo;</p>
                  <p className="mt-4 text-sm font-semibold">{item.name}</p>
                </Card>
              ))}
            </div>
          ) : (
            <StandardsFallback
              bullets={[
                "Appointment slots are confirmed in writing.",
                "Transparent exam-first treatment planning.",
                "Emergency guidance is always visible."
              ]}
            />
          )}
        </div>
      </section>

      <section id="faq" className={layout.dentalSection}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>FAQ</h2>
          <div className={`grid ${layout.gridGap}`}>
            {payload.faq.items.map((item) => (
              <Card key={item.question} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                <h3 className="text-lg font-semibold">{item.question}</h3>
                <p className="mt-2 text-sm text-neutral-700">{item.answer}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className={layout.dentalSection}>
        <div className={`${layout.container} grid md:grid-cols-2 ${layout.gridGap}`}>
          <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
            <h2 className="text-2xl font-semibold">Contact</h2>
            <p className="mt-3 text-sm text-neutral-700">{payload.contact.address}</p>
            <p className="mt-2 text-sm font-semibold">{payload.contact.phone}</p>
            <ul className={`mt-4 text-sm text-neutral-700 ${layout.listSpacing}`}>
              {payload.contact.hours.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-semibold text-neutral-900">{payload.contact.emergency_note}</p>
            <div className="mt-5">
              <CtaLink href={payload.contact.booking_cta_url} label={payload.contact.booking_cta_label} />
            </div>
          </Card>
          <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
            <h3 className="text-xl font-semibold">Map</h3>
            {payload.contact.map_url ? (
              <a href={payload.contact.map_url} className="mt-3 inline-block text-sm font-semibold underline">
                Open map
              </a>
            ) : (
              <p className="mt-3 text-sm text-neutral-600">Map link not provided.</p>
            )}
          </Card>
        </div>
      </section>

      <footer id="footer" className="border-t border-neutral-200 py-10">
        <div className={`${layout.container} flex flex-wrap items-center gap-4 text-sm text-neutral-700`}>
          <a href={payload.footer.legal_url}>Legal</a>
          <a href={payload.footer.privacy_url}>Privacy</a>
          <a href={payload.footer.accessibility_statement_url}>Accessibility</a>
        </div>
      </footer>
    </main>
  );
};

export const DeterministicServiceTemplate = ({ payload }: { payload: ServicePayload }) => {
  const showStaff = payload.staff.enabled && payload.staff.members.length > 0;
  const showReviews = payload.reviews.items.length > 0;

  return (
    <main className="bg-white text-neutral-900">
      <header className="border-b border-neutral-200 py-4">
        <div className={`${layout.container} flex flex-wrap items-center justify-between ${layout.gridGap}`}>
          <nav className="flex items-center gap-4 text-sm font-medium">
            {payload.header.nav_items.map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`}>
                {item}
              </a>
            ))}
          </nav>
          <CtaLink href={payload.header.primary_cta_url} label={payload.header.primary_cta_label} />
        </div>
      </header>

      <section id="hero" className={layout.section}>
        <div className={`${layout.container} grid items-center md:grid-cols-2 ${layout.gridGap}`}>
          <div>
            <h1 className={`${layout.headingSpacing} text-4xl font-semibold`}>{payload.hero.headline}</h1>
            <p className={`${layout.paragraphSpacing} text-base text-neutral-700`}>{payload.hero.tagline}</p>
            <CtaLink href={payload.hero.primary_cta_url} label={payload.hero.primary_cta_label} />
          </div>
          <ImageWithFallback
            src={payload.hero.hero_image.src}
            alt={payload.hero.hero_image.alt}
            ratio={payload.hero.hero_image.crop_desktop}
            fallbackLabel="Hero image unavailable"
          />
        </div>
      </section>

      <section id="services" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>Services</h2>
          <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
            {payload.services.items.map((item) => (
              <Card key={`${item.title}-${item.description}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-700">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>
            {payload.pricing.variant === "starting_at" ? "Starting at" : "Pricing"}
          </h2>
          <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
            {payload.pricing.items.map((item) => (
              <Card key={`${item.label}-${item.amount}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                <h3 className="text-lg font-semibold">{item.label}</h3>
                <p className="mt-2 text-xl font-semibold">{item.amount}</p>
                {item.detail ? <p className="mt-2 text-sm text-neutral-700">{item.detail}</p> : null}
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="staff" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>Staff</h2>
          {showStaff ? (
            <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
              {payload.staff.members.map((member) => (
                <Card key={member.name} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                  <ImageWithFallback
                    src={member.image.src}
                    alt={member.image.alt}
                    ratio={member.image.crop}
                    fallbackLabel="Staff image unavailable"
                  />
                  <h3 className="mt-4 text-lg font-semibold">{member.name}</h3>
                  <p className="mt-1 text-sm text-neutral-700">{member.role}</p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-700 shadow-none">
              Staff section is optional and currently hidden for this business profile.
            </Card>
          )}
        </div>
      </section>

      <section id="gallery" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>Gallery</h2>
          {payload.gallery.items.length === 0 ? (
            <GalleryPlaceholderCards />
          ) : (
            <div className={`grid sm:grid-cols-2 md:grid-cols-3 ${layout.gridGap}`}>
              {payload.gallery.items.map((item, index) => (
                <ImageWithFallback
                  key={`${item.src}-${index}`}
                  src={item.src}
                  alt={item.alt}
                  ratio={item.crop}
                  fallbackLabel="Gallery image unavailable"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="reviews" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} text-3xl font-semibold`}>
            {showReviews ? "Reviews" : "Hygiene & standards"}
          </h2>
          {showReviews ? (
            <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
              {payload.reviews.items.map((item) => (
                <Card key={`${item.name}-${item.quote}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                  <p className="text-sm text-neutral-700">&ldquo;{item.quote}&rdquo;</p>
                  <p className="mt-4 text-sm font-semibold">{item.name}</p>
                </Card>
              ))}
            </div>
          ) : (
            <StandardsFallback bullets={payload.reviews.fallback_hygiene_bullets} />
          )}
        </div>
      </section>

      <section id="contact" className={layout.section}>
        <div className={`${layout.container} grid md:grid-cols-2 ${layout.gridGap}`}>
          <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
            <h2 className="text-2xl font-semibold">Contact</h2>
            <p className="mt-3 text-sm text-neutral-700">{payload.contact.address}</p>
            <p className="mt-2 text-sm font-semibold">{payload.contact.phone}</p>
            <ul className={`mt-4 text-sm text-neutral-700 ${layout.listSpacing}`}>
              {payload.contact.hours.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-5">
              <CtaLink href={payload.contact.booking_cta_url} label={payload.contact.booking_cta_label} />
            </div>
          </Card>
          <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
            <h3 className="text-xl font-semibold">Quick booking</h3>
            <div className={`mt-4 grid ${layout.gridGap} ${layout.formMax}`}>
              <input className="h-11 rounded-xl border border-neutral-300 px-4 text-sm" placeholder="Name" aria-label="Name" />
              <input className="h-11 rounded-xl border border-neutral-300 px-4 text-sm" placeholder="Phone" aria-label="Phone" />
              <Button type="button" className="h-11 rounded-xl bg-neutral-900 text-white">
                {payload.contact.booking_cta_label}
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <footer id="footer" className="border-t border-neutral-200 py-10">
        <div className={`${layout.container} flex flex-wrap items-center gap-4 text-sm text-neutral-700`}>
          <a href={payload.footer.instagram_url}>Instagram</a>
          {payload.footer.email ? <span>{payload.footer.email}</span> : null}
        </div>
      </footer>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white p-4 sm:hidden">
        <div className="mx-auto max-w-xl">
          <CtaLink href={payload.contact.booking_cta_url} label={payload.contact.booking_cta_label} />
        </div>
      </div>
    </main>
  );
};

export const DeterministicRealEstateTemplate = ({ payload }: { payload: RealEstatePayload }) => {
  return (
    <main className="bg-zinc-100 text-neutral-900">
      <header className="border-b border-neutral-200 py-4">
        <div className={`${layout.container} flex flex-wrap items-center justify-between ${layout.gridGap}`}>
          <div>
            <p className="text-sm font-semibold">{payload.header.phone}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            {payload.header.nav_items.map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`}>
                {item}
              </a>
            ))}
          </nav>
          <CtaLink href={payload.header.primary_cta_url} label={payload.header.primary_cta_label} />
        </div>
      </header>

      <section id="hero" className={layout.section}>
        <div className={`${layout.container} grid items-center md:grid-cols-2 ${layout.gridGap}`}>
          <div>
            <p className="mb-4 inline-flex rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              {payload.hero.status_badge}
            </p>
            <h1 className={`${layout.headingSpacing} font-serif text-4xl leading-tight`}>{payload.hero.headline}</h1>
            <p className={`${layout.paragraphSpacing} text-base text-neutral-700`}>{payload.hero.subhead}</p>
            <div className="flex flex-wrap gap-4">
              <CtaLink href={payload.hero.primary_cta_url} label={payload.hero.primary_cta_label} />
              {payload.hero.secondary_cta_label && payload.hero.secondary_cta_url ? (
                <CtaLink href={payload.hero.secondary_cta_url} label={payload.hero.secondary_cta_label} secondary />
              ) : null}
            </div>
          </div>
          <ImageWithFallback
            src={payload.hero.hero_image.src}
            alt={payload.hero.hero_image.alt}
            ratio={payload.hero.hero_image.crop_desktop}
            fallbackLabel="Project hero image unavailable"
          />
        </div>
      </section>

      <section id="vision" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>Vision</h2>
          <p className="max-w-4xl text-base text-neutral-700">{payload.vision.paragraph}</p>
        </div>
      </section>

      <section id="residences" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>
            {payload.residences.variant === "property_cards" ? "Residences" : "Floorplan residences"}
          </h2>
          <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
            {payload.residences.items.map((item) => (
              <Card key={`${item.title}-${item.cta_url}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                <ImageWithFallback
                  src={item.image.src}
                  alt={item.image.alt}
                  ratio={item.image.crop}
                  fallbackLabel="Residence image unavailable"
                />
                <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-700">{item.summary}</p>
                <div className="mt-4">
                  <CtaLink href={item.cta_url} label={item.cta_label} secondary />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="amenities" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>Amenities</h2>
          <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
            {payload.amenities.items.map((item) => (
              <Card key={`${item.title}-${item.description}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-700">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="neighborhood" className={layout.section}>
        <div className={`${layout.container} grid md:grid-cols-2 ${layout.gridGap}`}>
          <div>
            <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>Neighborhood</h2>
            <ul className={`list-disc pl-6 text-sm text-neutral-700 ${layout.listSpacing}`}>
              {payload.neighborhood.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <ImageWithFallback
            src={payload.neighborhood.image.src}
            alt={payload.neighborhood.image.alt}
            ratio={payload.neighborhood.image.crop}
            fallbackLabel="Neighborhood visual unavailable"
          />
        </div>
      </section>

      <section id="floorplans" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>Floorplans & downloads</h2>
          <div className={`grid ${layout.gridGap}`}>
            {payload.floorplans.downloads.map((item) => (
              <Card key={item.url} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                <a href={item.url} className="text-sm font-semibold underline">
                  {item.label}
                </a>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="press" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>Press</h2>
          {payload.press.items.length === 0 ? (
            <Card className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700 shadow-none">
              Press items are not available.
            </Card>
          ) : (
            <div className={`grid md:grid-cols-2 ${layout.gridGap}`}>
              {payload.press.items.map((item) => (
                <Card key={`${item.outlet}-${item.title}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                  <p className="text-xs font-semibold uppercase text-neutral-500">{item.outlet}</p>
                  <p className="mt-2 text-sm text-neutral-800">{item.title}</p>
                  <a href={item.url} className="mt-3 inline-block text-sm font-semibold underline">
                    Read
                  </a>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="team" className={layout.section}>
        <div className={layout.container}>
          <h2 className={`${layout.headingSpacing} font-serif text-3xl`}>Team</h2>
          {payload.team.members.length === 0 ? (
            <Card className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700 shadow-none">
              Team details are not available.
            </Card>
          ) : (
            <div className={`grid md:grid-cols-3 ${layout.gridGap}`}>
              {payload.team.members.map((member) => (
                <Card key={`${member.name}-${member.role}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-none">
                  <h3 className="text-lg font-semibold">{member.name}</h3>
                  <p className="mt-2 text-sm text-neutral-700">{member.role}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="contact" className={layout.section}>
        <div className={`${layout.container} grid md:grid-cols-2 ${layout.gridGap}`}>
          <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
            <h2 className="text-2xl font-semibold">Contact</h2>
            <p className="mt-3 text-sm text-neutral-700">{payload.contact.address}</p>
            <p className="mt-2 text-sm font-semibold">{payload.contact.phone}</p>
            <p className="mt-4 text-xs text-neutral-600">{payload.contact.legal_teaser}</p>
            <div className="mt-5">
              <CtaLink href={payload.contact.inquire_cta_url} label={payload.contact.inquire_cta_label} />
            </div>
          </Card>
          <Card className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
            <h3 className="text-xl font-semibold">Map access</h3>
            <p className="mt-3 text-sm text-neutral-700">Mode: {payload.contact.map_mode}</p>
            <Separator className="my-4 bg-neutral-200" />
            {payload.contact.map_mode === "interactive" ? (
              <div className={`text-sm text-neutral-700 ${layout.listSpacing}`}>
                <p>Start without audio: {payload.contact.start_without_audio ? "Yes" : "No"}</p>
                {payload.contact.keyboard_navigation_url ? (
                  <a href={payload.contact.keyboard_navigation_url} className="underline">
                    Keyboard navigation alternative
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-neutral-700">Static map fallback enabled.</p>
            )}
          </Card>
        </div>
      </section>

      <footer id="footer" className="border-t border-neutral-200 py-10">
        <div className={`${layout.container} flex flex-wrap items-center gap-4 text-sm text-neutral-700`}>
          <a href={payload.footer.legal_url}>Legal</a>
          <a href={payload.footer.privacy_url}>Privacy</a>
          <a href={payload.footer.downloads_url}>Downloads</a>
        </div>
      </footer>
    </main>
  );
};

export const DeterministicTemplateRenderer = ({ payload }: { payload: DeterministicPayload }) => {
  switch (payload.template) {
    case "restaurant":
      return <DeterministicRestaurantTemplate payload={payload} />;
    case "dental":
      return <DeterministicDentalTemplate payload={payload} />;
    case "service":
      return <DeterministicServiceTemplate payload={payload} />;
    case "real_estate":
      return <DeterministicRealEstateTemplate payload={payload} />;
    default:
      return null;
  }
};
