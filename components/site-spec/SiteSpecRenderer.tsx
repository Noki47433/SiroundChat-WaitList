/**
 * The deterministic Site Spec renderer.
 *
 * Given the same spec, the same business data and the same assets, this
 * produces the same markup — no clock, no randomness, no network, no model.
 * That is the whole point: output reliability is owned here, not hoped for
 * upstream.
 *
 * Two rules this file lives by:
 *
 *  · **No industry branch.** Search this file for a trade name and you will not
 *    find one. A barber site and a photography site differ because their specs
 *    chose different layouts, presentations, art direction and terminology.
 *  · **No invention.** Every price, duration, name, address and opening time is
 *    a value the resolver read from canonical business data. Where a fact is
 *    missing the renderer omits it; it never fills the gap.
 */
import type { CSSProperties, ReactNode } from "react";

import styles from "@/components/site-spec/site-spec.module.css";
import { SiteSpecEnquiryForm } from "@/components/site-spec/SiteSpecEnquiryForm";
import { SiteSpecBookingPanel } from "@/components/site-spec/SiteSpecBookingPanel";
import {
  resolveCtaLink,
  resolveMedia,
  selectServices,
  selectTeam,
  specTextToString,
  type ResolvedSite
} from "@/lib/site-spec/resolve";
import type { Cta, MediaRef, Section, SiteSpec } from "@/lib/site-spec/schema";
import type { SectionLayout } from "@/lib/site-spec/vocabulary";
import {
  brandLengthVariable,
  designToCssVariables,
  designToDataAttributes,
  generatedArtStyle
} from "@/lib/site-spec/tokens";

// ─────────────────────────────────────────────────────────────────────────────
// Class helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSS Modules hash every class, so a site class can never collide with builder
 * chrome. Unknown names are dropped rather than emitted raw.
 */
const cx = (...names: Array<string | false | null | undefined>): string =>
  names
    .filter((name): name is string => Boolean(name))
    .map((name) => (styles as Record<string, string | undefined>)[name])
    .filter((name): name is string => Boolean(name))
    .join(" ");

// ─────────────────────────────────────────────────────────────────────────────
// Which sections have anything to draw
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A public website should not show an empty "Services" heading because the
 * business has not added a service yet. Sections that would render nothing are
 * dropped from both the page and the navigation.
 */
export const isSectionRenderable = (site: ResolvedSite, section: Section): boolean => {
  switch (section.type) {
    case "services":
      return selectServices(site, section.selection).length > 0;
    case "team":
      return selectTeam(site, section.selection).length > 0;
    case "hours":
      return site.hasHours && site.hours.length > 0;
    case "reviews":
      return section.presentation === "empty" || section.items.length > 0;
    case "contact":
      return Boolean(site.contact.address || site.contact.phone || site.contact.email);
    default:
      return true;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────────────────────

type ImageProps = {
  site: ResolvedSite;
  media: MediaRef;
  fallbackAlt: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * One image. A pinned asset and generated art share the same treatment stack,
 * so an owner's photograph is graded like the rest of the site rather than
 * sitting in it as a foreign rectangle.
 */
function Img({ site, media, fallbackAlt, className, style }: ImageProps) {
  const image = resolveMedia(site, media, fallbackAlt);
  const treatment = site.spec.design.art.treatment;

  if (image.kind === "asset") {
    return (
      <div className={cx("im", className)} data-tr={treatment} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element -- published sites
            are served from arbitrary owner asset hosts, which the Next image
            optimiser would have to be configured for host by host. */}
        <img src={image.url} alt={image.alt} loading="lazy" decoding="async" />
      </div>
    );
  }

  return (
    <div
      className={cx("im", className)}
      data-tr={treatment}
      role={image.alt ? "img" : undefined}
      aria-label={image.alt || undefined}
      style={{ ...generatedArtStyle(site.spec.design.art, image.index), ...style }}
    />
  );
}

/** Generated art addressed by index — galleries, maps and portraits use this. */
function ArtTile({
  site,
  index,
  alt,
  className,
  style
}: {
  site: ResolvedSite;
  index: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx("im", className)}
      data-tr={site.spec.design.art.treatment}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      style={{ ...generatedArtStyle(site.spec.design.art, index), ...style }}
    />
  );
}

function CtaLink({ site, cta, ghost }: { site: ResolvedSite; cta: Cta; ghost?: boolean }) {
  const link = resolveCtaLink(site, cta);
  return (
    <a
      className={cx("wbtn", ghost && "ghost")}
      href={link.href}
      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {link.label}
    </a>
  );
}

/** Eyebrow → heading → sub. The most common section opening, but not the only one. */
function Head({ site, section }: { site: ResolvedSite; section: Section }) {
  const eyebrow = specTextToString(site, section.heading.eyebrow);
  const title = specTextToString(site, section.heading.title);
  const sub = specTextToString(site, section.heading.sub);
  if (!eyebrow && !title && !sub) return null;
  return (
    <div className={cx("head")}>
      {eyebrow ? <div className={cx("wlbl")}>{eyebrow}</div> : null}
      {title ? <h2 className={cx("wh2")}>{title}</h2> : null}
      {sub ? <p className={cx("wp")}>{sub}</p> : null}
    </div>
  );
}

/** Every section that is placed by a layout. Heroes and bands opt out. */
type LaidOutSection = Extract<Section, { layout: SectionLayout }>;

/** The standard section shell: heading, then body, inside the chosen layout. */
function Shell({
  site,
  section,
  children,
  extraClass
}: {
  site: ResolvedSite;
  section: LaidOutSection;
  children: ReactNode;
  extraClass?: string;
}) {
  return (
    <section id={section.id} className={cx("wsec", `lay-${section.layout}`, extraClass)}>
      <Head site={site} section={section} />
      <div className={cx("body")}>{children}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero — three variants
// ─────────────────────────────────────────────────────────────────────────────

function Hero({ site, section }: { site: ResolvedSite; section: Extract<Section, { type: "hero" }> }) {
  const eyebrow = specTextToString(site, section.eyebrow);
  const body = specTextToString(site, section.body);

  const headline = (
    <h1 className={cx("hero-h")}>
      {section.headline.split("\n").map((line, index, all) => (
        <span key={index}>
          {line}
          {index < all.length - 1 ? <br /> : null}
        </span>
      ))}
    </h1>
  );

  const actions = (
    <div className={cx("wacts")}>
      <CtaLink site={site} cta={section.primaryCta} />
      {section.secondaryCta ? <CtaLink site={site} cta={section.secondaryCta} ghost /> : null}
    </div>
  );

  const media = (
    <Img site={site} media={section.media} fallbackAlt={site.brandName} />
  );

  if (section.variant === "full") {
    return (
      <section id={section.id} className={cx("wsec", "hero", "hero-full")}>
        <div className={cx("bg")}>{media}</div>
        <div className={cx("hscrim")} />
        {section.accentRule ? <span className={cx("accentrule")} /> : null}
        <div className={cx("in")}>
          {eyebrow ? <div className={cx("wlbl")}>{eyebrow}</div> : null}
          {headline}
          {body ? <p className={cx("wp")}>{body}</p> : null}
          {actions}
        </div>
      </section>
    );
  }

  if (section.variant === "split") {
    return (
      <section id={section.id} className={cx("wsec", "hero", "hero-split")}>
        <div className={cx("in")}>
          {eyebrow ? <div className={cx("wlbl")}>{eyebrow}</div> : null}
          {headline}
          {body ? <p className={cx("wp")}>{body}</p> : null}
          {actions}
        </div>
        <div className={cx("md")}>{media}</div>
      </section>
    );
  }

  return (
    <section id={section.id} className={cx("wsec", "hero", "hero-ed")}>
      <div className={cx("in")}>
        {eyebrow ? <div className={cx("wlbl")}>{eyebrow}</div> : null}
        {headline}
      </div>
      {body ? <p className={cx("wp")}>{body}</p> : null}
      {actions}
      <div className={cx("band")}>{media}</div>
      {section.bandCaption ? <div className={cx("bandcap")}>{section.bandCaption}</div> : null}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Services — four presentations over the same canonical rows
// ─────────────────────────────────────────────────────────────────────────────

function Services({
  site,
  section
}: {
  site: ResolvedSite;
  section: Extract<Section, { type: "services" }>;
}) {
  const rows = selectServices(site, section.selection);
  const price = (value: string | null) => (section.showPrices ? value : null);
  const duration = (value: string) => (section.showDurations ? value : null);
  const describe = (value: string | null) => (section.showDescriptions ? value : null);

  let body: ReactNode;

  if (section.presentation === "rows") {
    body = (
      <div className={cx("svc-rows")}>
        {rows.map((service) => (
          <div key={service.id} className={cx("r")}>
            <span className={cx("nm")}>{service.name}</span>
            <span className={cx("dt")} />
            {duration(service.duration) ? (
              <span className={cx("du")}>{service.duration}</span>
            ) : null}
            {price(service.price) ? <span className={cx("pr")}>{service.price}</span> : null}
          </div>
        ))}
      </div>
    );
  } else if (section.presentation === "cards") {
    body = (
      <div className={cx("svc-cards")}>
        {rows.map((service, index) => (
          <div key={service.id} className={cx("c")}>
            {section.withImages ? <ArtTile site={site} index={index + 1} alt="" /> : null}
            <div className={cx("cx")}>
              <div className={cx("nm")}>{service.name}</div>
              {describe(service.description) ? (
                <div className={cx("ds")}>{service.description}</div>
              ) : null}
              <div className={cx("mt")}>
                {price(service.price) ? <span className={cx("pr")}>{service.price}</span> : null}
                {duration(service.duration) ? (
                  <span className={cx("du")}>{service.duration}</span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  } else if (section.presentation === "editorial") {
    body = (
      <div className={cx("svc-ed")}>
        {rows.map((service) => (
          <div key={service.id} className={cx("r")}>
            <div>
              <div className={cx("nm")}>{service.name}</div>
              {describe(service.description) ? (
                <div className={cx("ds")}>{service.description}</div>
              ) : null}
            </div>
            <div>
              {price(service.price) ? <div className={cx("pr")}>{service.price}</div> : null}
              {duration(service.duration) ? (
                <div className={cx("du")}>{service.duration}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  } else {
    body = (
      <div className={cx("svc-pk")}>
        {rows.map((service) => (
          <div key={service.id} className={cx("c")}>
            <div className={cx("nm")}>{service.name}</div>
            {price(service.price) ? <div className={cx("pr")}>{service.price}</div> : null}
            {describe(service.description) ? (
              <div className={cx("ds")}>{service.description}</div>
            ) : null}
            {duration(service.duration) ? (
              <div className={cx("du")}>{service.duration}</div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Shell site={site} section={section}>
      {body}
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gallery, story, team, hours
// ─────────────────────────────────────────────────────────────────────────────

function Gallery({
  site,
  section
}: {
  site: ResolvedSite;
  section: Extract<Section, { type: "gallery" }>;
}) {
  const ratio = section.framing.ratio;
  return (
    <Shell site={site} section={section}>
      <div className={cx("gal", section.presentation)}>
        {section.items.map((media, index) => {
          const caption = section.captions[index];
          const tile = (
            <Img
              site={site}
              media={media}
              fallbackAlt={`${site.brandName} — ${index + 1}`}
              style={ratio ? { aspectRatio: ratio } : undefined}
            />
          );
          if (!caption) return <div key={index}>{tile}</div>;
          return (
            <figure key={index} className={cx("fig")}>
              {tile}
              <figcaption>{caption}</figcaption>
            </figure>
          );
        })}
      </div>
    </Shell>
  );
}

function Story({
  site,
  section
}: {
  site: ResolvedSite;
  section: Extract<Section, { type: "story" }>;
}) {
  if (section.presentation === "pullquote") {
    const quote = section.quote ?? section.body;
    return (
      <Shell site={site} section={section}>
        {quote ? (
          <blockquote className={cx("pull")}>
            <span className={cx("qm")}>“</span>
            {quote}
          </blockquote>
        ) : null}
        {section.attribution ? <div className={cx("pullby")}>{section.attribution}</div> : null}
        {section.stats.length ? (
          <div className={cx("statrow")}>
            {section.stats.map((stat, index) => (
              <div key={index} className={cx("s")}>
                <div className={cx("v")}>{stat.value}</div>
                <div className={cx("k")}>{stat.label}</div>
              </div>
            ))}
          </div>
        ) : null}
      </Shell>
    );
  }

  const body = section.body ?? section.quote;
  return (
    <Shell site={site} section={section}>
      {body ? <p className={cx("wp")}>{body}</p> : null}
    </Shell>
  );
}

function Team({
  site,
  section
}: {
  site: ResolvedSite;
  section: Extract<Section, { type: "team" }>;
}) {
  const members = selectTeam(site, section.selection);
  const variant =
    section.presentation === "overlay" ? "overlay" : section.presentation === "editorial" ? "ed" : null;

  return (
    <Shell site={site} section={section}>
      <div
        className={cx("team", variant)}
        style={{ "--team-ar": section.ratio } as CSSProperties}
      >
        {members.map((member) =>
          section.presentation === "overlay" ? (
            <div key={member.id} className={cx("m")}>
              <Portrait site={site} member={member} />
              <div className={cx("cap")}>
                <div className={cx("nm")}>{member.name}</div>
                {section.showRoles && member.role ? (
                  <div className={cx("rl2")}>{member.role}</div>
                ) : null}
              </div>
            </div>
          ) : (
            <div key={member.id} className={cx("m")}>
              <div className={cx("nm")}>{member.name}</div>
              {section.showRoles && member.role ? (
                <div className={cx("rl2")}>{member.role}</div>
              ) : null}
              <Portrait site={site} member={member} />
            </div>
          )
        )}
      </div>
    </Shell>
  );
}

function Portrait({
  site,
  member
}: {
  site: ResolvedSite;
  member: { name: string; portrait: { kind: "asset" | "generated"; index?: number; url?: string; alt: string } };
}) {
  if (member.portrait.kind === "asset" && member.portrait.url) {
    return (
      <div className={cx("im")} data-tr={site.spec.design.art.treatment}>
        {/* eslint-disable-next-line @next/next/no-img-element -- see Img above */}
        <img src={member.portrait.url} alt={member.portrait.alt} loading="lazy" decoding="async" />
      </div>
    );
  }
  return <ArtTile site={site} index={member.portrait.index ?? 0} alt={member.name} />;
}

function Hours({
  site,
  section
}: {
  site: ResolvedSite;
  section: Extract<Section, { type: "hours" }>;
}) {
  // The site shows the business's real upcoming exceptions, or the spec's own
  // note — never a plausible-sounding closure nobody entered.
  const exceptionNote = section.showExceptions
    ? site.exceptions
        .slice(0, 2)
        .map((exception) => `${exception.title} — ${exception.value}`)
        .join(" · ")
    : "";
  const note = exceptionNote || section.note;

  return (
    <Shell site={site} section={section}>
      <div className={cx("hrs", section.presentation)}>
        {site.hours.map((row, index) => (
          <div key={index} className={cx("d", row.closed && "off")}>
            <span>{row.label}</span>
            <span>{row.value}</span>
          </div>
        ))}
      </div>
      {note ? (
        <div className={cx("note", section.noteStyle === "rule" && "rule")}>
          <span aria-hidden={section.noteStyle === "rule" ? undefined : "true"}>
            {section.noteStyle === "rule" ? "" : "ⓘ"}
          </span>
          <span>{note}</span>
        </div>
      ) : null}
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking, enquiry, reviews, contact
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A booking panel invites a booking. It deliberately does not draw time slots:
 * the renderer has no availability, and a page that shows "11:00" it cannot
 * hold is worse than one that does not.
 */
function Booking({
  site,
  section,
  slug
}: {
  site: ResolvedSite;
  section: Extract<Section, { type: "booking" }>;
  slug: string | null;
}) {
  const variant = section.presentation === "panel" ? null : section.presentation;
  const link = resolveCtaLink(site, section.cta);

  return (
    <section id={section.id} className={cx("wsec", `lay-${section.layout}`)}>
      <div className={cx("bookpanel", variant)}>
        <div>
          <Head site={site} section={section} />
        </div>
        {/*
          The renderer draws the shell and no times. Real availability arrives at
          runtime from the existing booking engine, or the panel says it could
          not check — it never invents a slot. See SiteSpecBookingPanel.
        */}
        {site.bookingEnabled ? (
          <SiteSpecBookingPanel
            slug={slug}
            services={site.services.map((service) => ({ id: service.id, name: service.name }))}
            ctaLabel={link.label}
            ctaHref={link.href}
            locale={site.locale}
            classNames={{
              slots: cx("slots"),
              slot: cx("slot"),
              button: cx("wbtn"),
              note: cx("wp"),
              actions: cx("wacts")
            }}
          />
        ) : (
          <div className={cx("wacts")}>
            <CtaLink site={site} cta={section.cta} />
          </div>
        )}
      </div>
    </section>
  );
}

function Enquiry({
  site,
  section,
  slug
}: {
  site: ResolvedSite;
  section: Extract<Section, { type: "enquiry" }>;
  slug: string | null;
}) {
  const variant = section.presentation === "panel" ? null : section.presentation;
  return (
    <section id={section.id} className={cx("wsec", `lay-${section.layout}`)}>
      <div className={cx("bookpanel", variant)}>
        <div>
          <Head site={site} section={section} />
        </div>
        <SiteSpecEnquiryForm
          slug={slug}
          fields={section.fields}
          submitLabel={section.cta.label}
          classNames={{
            fields: cx("fields"),
            field: cx("fld"),
            button: cx("wbtn"),
            note: cx("wp")
          }}
        />
      </div>
    </section>
  );
}

function Reviews({
  site,
  section
}: {
  site: ResolvedSite;
  section: Extract<Section, { type: "reviews" }>;
}) {
  if (section.presentation === "empty" || !section.items.length) {
    return (
      <Shell site={site} section={section}>
        <div className={cx("revempty")}>
          <b>No reviews connected yet</b>
          <span>
            Connect your reviews, or add ones you have received.
            <br />
            SurroundChat will never write a review for you.
          </span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell site={site} section={section}>
      <div className={cx("svc-cards")}>
        {section.items.map((review, index) => (
          <figure key={index} className={cx("c")}>
            <div className={cx("cx")}>
              <blockquote className={cx("ds")}>{review.quote}</blockquote>
              <figcaption className={cx("mt")}>
                <span className={cx("nm")}>{review.author}</span>
                {review.rating ? (
                  <span className={cx("du")} aria-label={`${review.rating} out of 5`}>
                    {review.rating}/5
                  </span>
                ) : null}
              </figcaption>
            </div>
          </figure>
        ))}
      </div>
    </Shell>
  );
}

function Contact({
  site,
  section
}: {
  site: ResolvedSite;
  section: Extract<Section, { type: "contact" }>;
}) {
  const { address, phone } = site.contact;
  const socials = section.showSocials ? site.socials : [];

  const socialPills = socials.length ? (
    <div className={cx("socs")}>
      {socials.map((social) => (
        <a
          key={social.href}
          className={cx("soc")}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {social.label}
        </a>
      ))}
    </div>
  ) : null;

  const action = section.cta ? (
    <div className={cx("wacts")}>
      <CtaLink site={site} cta={section.cta} />
    </div>
  ) : null;

  const map = section.showMap ? <ArtTile site={site} index={4} alt="" /> : null;

  if (section.presentation === "panel") {
    return (
      <section id={section.id} className={cx("wsec", "flush")} style={{ paddingBlock: 0 }}>
        <div className={cx("ct-panel")}>
          <div className={cx("side")}>
            <Head site={site} section={section} />
            {action}
            {socialPills}
          </div>
          {map ? <div className={cx("map")}>{map}</div> : null}
        </div>
      </section>
    );
  }

  if (section.presentation === "center") {
    return (
      <section id={section.id} className={cx("wsec", `lay-${section.layout}`)}>
        <Head site={site} section={section} />
        <div className={cx("body", "ct-center")}>
          <div className={cx("lines")}>
            {address}
            {address && phone ? <br /> : null}
            {phone}
          </div>
          {action}
          {socialPills}
          {map ? <div className={cx("map")}>{map}</div> : null}
        </div>
      </section>
    );
  }

  if (section.presentation === "stack") {
    return (
      <section id={section.id} className={cx("wsec", `lay-${section.layout}`)}>
        <Head site={site} section={section} />
        <div className={cx("body", "ct-stack")}>
          <div className={cx("rows")}>
            {address ? (
              <div>
                <div className={cx("k")}>{site.spec.terminology.contact}</div>
                <div className={cx("v")}>{address}</div>
              </div>
            ) : null}
            {phone ? (
              <div>
                <div className={cx("k")}>Telephone</div>
                <div className={cx("v")}>{phone}</div>
              </div>
            ) : null}
            {socials.length ? (
              <div>
                <div className={cx("k")}>Follow</div>
                <div className={cx("v")}>
                  {socials.map((social) => (
                    <a key={social.href} href={social.href} target="_blank" rel="noopener noreferrer">
                      {social.label}
                      <br />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {map ? <div className={cx("band")}>{map}</div> : null}
        </div>
      </section>
    );
  }

  return (
    <section id={section.id} className={cx("wsec", `lay-${section.layout}`)}>
      <Head site={site} section={section} />
      <div className={cx("body")}>
        <div className={cx("ct-split")}>
          <div>
            <p className={cx("wp")} style={{ marginTop: 0 }}>
              {address}
              {address && phone ? <br /> : null}
              {phone}
            </p>
            {action}
            {socialPills}
          </div>
          {map ? <div className={cx("map")}>{map}</div> : null}
        </div>
      </div>
    </section>
  );
}

function BookingStrip({
  site,
  section
}: {
  site: ResolvedSite;
  section: Extract<Section, { type: "bookingStrip" }>;
}) {
  return (
    <section id={section.id} className={cx("bookstrip")}>
      <div>
        <div className={cx("t")}>{section.headline}</div>
        {section.sub ? <div className={cx("s")}>{section.sub}</div> : null}
      </div>
      <div />
      <CtaLink site={site} cta={section.cta} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome
// ─────────────────────────────────────────────────────────────────────────────

function Nav({ site, visible }: { site: ResolvedSite; visible: Set<string> }) {
  const items = site.nav.items.filter((item) => visible.has(item.id));
  return (
    <nav className={cx("wnav")}>
      <div className={cx("brand")}>
        <span className={cx("bm")}>{site.brandMark}</span>
        {site.brandName}
      </div>
      <div className={cx("lk")}>
        {items.map((item) => (
          <a key={item.id} href={`#${item.id}`}>
            {item.label}
          </a>
        ))}
      </div>
      <a
        className={cx("nb")}
        href={site.nav.cta.href}
        {...(site.nav.cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {site.nav.cta.label}
      </a>
    </nav>
  );
}

function Footer({ site }: { site: ResolvedSite }) {
  const { footer } = site.spec;
  const { address, phone } = site.contact;

  const brand = (
    <div className={cx("brandline")}>
      <span className={cx("bm")}>{site.brandMark}</span>
      {site.brandName}
    </div>
  );

  const socialText = site.socials.map((social) => social.label).join(" · ");

  const base = (
    <div className={cx("ftbase")}>
      <span>
        © {site.brandName}
      </span>
      <div className={cx("fr")}>
        {footer.note ? <span>{footer.note}</span> : null}
        <span>Built with SurroundChat</span>
      </div>
    </div>
  );

  if (footer.presentation === "brand") {
    return (
      <>
        <footer className={cx("wfoot", "ft-brand")}>
          <div className={cx("big")} style={brandLengthVariable(site.brandName)}>
            {site.brandName.toUpperCase()}
          </div>
          <div className={cx("row")}>
            {brand}
            <div className={cx("fr")}>
              {address ? <span>{address}</span> : null}
              {phone ? <span>{phone}</span> : null}
              {socialText ? <span>{socialText}</span> : null}
            </div>
          </div>
        </footer>
        {base}
      </>
    );
  }

  if (footer.presentation === "editorial") {
    return (
      <>
        <footer className={cx("wfoot", "ft-ed")}>
          <div className={cx("cl")}>
            <div className={cx("ftname")}>{site.brandName}</div>
            {footer.ctaHeadline ? <div className={cx("ftline")}>{footer.ctaHeadline}</div> : null}
          </div>
          <div className={cx("cl")}>
            <div className={cx("h")}>{site.spec.terminology.contact}</div>
            {address ? <span className={cx("l")}>{address}</span> : null}
            {phone ? <span className={cx("l")}>{phone}</span> : null}
          </div>
          {site.hasHours ? (
            <div className={cx("cl")}>
              <div className={cx("h")}>{site.spec.terminology.hours}</div>
              {site.hours.slice(0, 4).map((row, index) => (
                <span key={index} className={cx("l")}>
                  {row.label} · {row.value}
                </span>
              ))}
            </div>
          ) : null}
          {site.socials.length ? (
            <div className={cx("cl")}>
              <div className={cx("h")}>Follow</div>
              {site.socials.map((social) => (
                <a key={social.href} className={cx("l")} href={social.href} target="_blank" rel="noopener noreferrer">
                  {social.label}
                </a>
              ))}
            </div>
          ) : null}
        </footer>
        {base}
      </>
    );
  }

  if (footer.presentation === "cta") {
    return (
      <>
        <footer className={cx("wfoot", "ft-cta")}>
          <div className={cx("h")}>{footer.ctaHeadline ?? site.spec.terminology.primaryAction}</div>
          <a
            className={cx("wbtn")}
            href={site.nav.cta.href}
            {...(site.nav.cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {site.nav.cta.label}
          </a>
        </footer>
        {base}
      </>
    );
  }

  return (
    <footer className={cx("wfoot", "ft-min")}>
      {brand}
      <div className={cx("fr")}>
        {address ? <span>{address}</span> : null}
        {phone ? <span>{phone}</span> : null}
        {socialText ? <span>{socialText}</span> : null}
        {footer.note ? <span>{footer.note}</span> : null}
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export type SiteSpecRendererProps = {
  site: ResolvedSite;
  /** Published slug, used by the enquiry form to address the submissions API. */
  slug?: string | null;
};

export function SiteSpecRenderer({ site, slug = null }: SiteSpecRendererProps) {
  const spec: SiteSpec = site.spec;
  const sections = spec.sections.filter((section) => isSectionRenderable(site, section));
  const visible = new Set(sections.map((section) => section.id));

  return (
    <div
      className={cx("site")}
      {...designToDataAttributes(spec.design)}
      style={designToCssVariables(spec.design)}
      lang={spec.meta.locale}
    >
      <Nav site={site} visible={visible} />
      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return <Hero key={section.id} site={site} section={section} />;
          case "bookingStrip":
            return <BookingStrip key={section.id} site={site} section={section} />;
          case "services":
            return <Services key={section.id} site={site} section={section} />;
          case "gallery":
            return <Gallery key={section.id} site={site} section={section} />;
          case "story":
            return <Story key={section.id} site={site} section={section} />;
          case "team":
            return <Team key={section.id} site={site} section={section} />;
          case "hours":
            return <Hours key={section.id} site={site} section={section} />;
          case "booking":
            return <Booking key={section.id} site={site} section={section} slug={slug} />;
          case "enquiry":
            return <Enquiry key={section.id} site={site} section={section} slug={slug} />;
          case "reviews":
            return <Reviews key={section.id} site={site} section={section} />;
          case "contact":
            return <Contact key={section.id} site={site} section={section} />;
          default:
            return null;
        }
      })}
      <Footer site={site} />
    </div>
  );
}

export default SiteSpecRenderer;
