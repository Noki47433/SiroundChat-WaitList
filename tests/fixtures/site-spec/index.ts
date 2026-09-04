/**
 * The four approved renderer regression fixtures.
 *
 *   Prishtina Fade Co.   barbershop        cinematic dark, service-led
 *   Lumi Nails Studio    nail studio       clean bright, gallery-forward
 *   Elegance Beauty      beauty salon      editorial serif, consultation-led
 *   Lens & Light         photography       photographic dark, portfolio-first
 *
 * They exist to prove one renderer can produce materially different websites.
 * They are TEST FIXTURES ONLY: nothing under `lib/site-spec` or
 * `components/site-spec` imports this file, and no code path anywhere branches
 * on which fixture is in play. A fifth business with entirely different choices
 * would need no renderer change at all.
 *
 * Canonical operational data (services, prices, durations, team, hours,
 * address, phone) lives in the `BusinessPayload` half of each fixture — exactly
 * where it lives in production. The specs carry only presentation.
 */
import type { BookingMigrationState } from "@/lib/booking/migration-state";
import { capabilitiesForState } from "@/lib/bookings/capabilities";
import type {
  BusinessPayload,
  BusinessService,
  BusinessTeamMember,
  HoursRow
} from "@/lib/business/load";
import type { SiteSpec } from "@/lib/site-spec/schema";
import { ELEGANCE_ART, FADE_ART, LENS_ART, LUMI_ART } from "@/tests/fixtures/site-spec/art";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic ids
// ─────────────────────────────────────────────────────────────────────────────

/** Stable, readable, valid v4-shaped uuids — no randomness in a fixture. */
const uuid = (prefix: string, n: number): string => {
  const hex = prefix
    .padEnd(8, "0")
    .slice(0, 8)
    .split("")
    .map((c) => (c.charCodeAt(0) % 16).toString(16))
    .join("");
  const tail = String(n).padStart(12, "0");
  return `${hex}-1111-4111-8111-${tail}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Business payload builder
// ─────────────────────────────────────────────────────────────────────────────

type ServiceSeed = {
  name: string;
  description: string;
  priceCents: number | null;
  priceMode?: BusinessService["priceMode"];
  durationMin: number;
};

type FixtureSeed = {
  key: string;
  businessName: string;
  address: string;
  phone: string;
  currency: string;
  services: ServiceSeed[];
  /** Team member name → the services they alone perform (drives the derived role). */
  team: Array<{ name: string; soleServiceIndex?: number }>;
  hours: Array<[label: string, open: string | null, close: string | null]>;
  exceptions?: Array<{ title: string; value: string }>;
  bookingState?: BookingMigrationState;
};

const buildBusiness = (seed: FixtureSeed): BusinessPayload => {
  const services: BusinessService[] = seed.services.map((service, index) => ({
    id: uuid(`${seed.key}svc`, index + 1),
    name: service.name,
    description: service.description,
    priceMode: service.priceMode ?? "fixed",
    basePriceCents: service.priceCents,
    currency: seed.currency,
    durationMin: service.durationMin,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    displayOrder: index,
    isActive: true,
    performedBy: [],
    performedByEveryone: true
  }));

  const team: BusinessTeamMember[] = seed.team.map((member, index) => ({
    id: uuid(`${seed.key}tm`, index + 1),
    name: member.name,
    isBookable: true,
    isActive: true,
    followsBusinessHours: true,
    schedule: [],
    scheduleSummary: null,
    breaks: [],
    timeOff: [],
    serviceIds:
      member.soleServiceIndex != null
        ? [services[member.soleServiceIndex].id]
        : services.map((service) => service.id),
    overrides: []
  }));

  const hours: HoursRow[] = seed.hours.map(([label, open, close], index) => ({
    label,
    weekdays: [index],
    open,
    close,
    closed: !open || !close
  }));

  return {
    businessId: uuid(`${seed.key}biz`, 1),
    businessName: seed.businessName,
    // The real mapping, not a hand-written stand-in: a fixture that disagreed
    // with production capability resolution would test the wrong thing.
    capabilities: capabilitiesForState(seed.bookingState ?? "neutral_active"),
    location: {
      id: uuid(`${seed.key}loc`, 1),
      name: seed.businessName,
      timezone: "Europe/Belgrade",
      address: seed.address,
      phone: seed.phone
    },
    hasHours: true,
    hours,
    dormantEligibility: [],
    rawHours: [],
    exceptions: (seed.exceptions ?? []).map((exception, index) => ({
      id: uuid(`${seed.key}exc`, index + 1),
      kind: "special_hours" as const,
      title: exception.title,
      startsOn: "2026-11-28",
      endsOn: "2026-11-28",
      value: exception.value,
      detail: null,
      source: "business" as const,
      overrideId: null,
      teamMemberId: null
    })),
    services,
    team,
    booking: {
      settingsId: uuid(`${seed.key}bs`, 1),
      locationScoped: false,
      approvalMode: "auto",
      slotIntervalMin: 15,
      leadTimeMin: 60,
      maxDaysAhead: 90,
      softHoldMinutes: 10,
      cancellationWindowMin: 120
    }
  };
};

const STAMP = "2026-09-01T09:00:00.000Z";

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Prishtina Fade Co. — cinematic dark, service-led, booking-centric
// ─────────────────────────────────────────────────────────────────────────────

export const FADE_BUSINESS = buildBusiness({
  key: "fade",
  businessName: "Prishtina Fade Co.",
  address: "Rr. Nëna Terezë 24, Prishtina",
  phone: "+383 44 210 118",
  currency: "EUR",
  services: [
    {
      name: "Skin fade",
      description: "Tight taper blended to the skin, finished with a hot towel.",
      priceCents: 1200,
      durationMin: 30
    },
    {
      name: "Fade + beard",
      description: "Full cut with beard shaping and a clean line-up.",
      priceCents: 1800,
      durationMin: 45
    },
    {
      name: "Hot towel shave",
      description: "Traditional straight-razor shave.",
      priceCents: 1000,
      durationMin: 30
    },
    {
      name: "Kids cut",
      description: "Under 12s, patient chair-side, no rush.",
      priceCents: 800,
      durationMin: 25
    }
  ],
  team: [{ name: "Arben" }, { name: "Dritan" }, { name: "Leart", soleServiceIndex: 3 }],
  hours: [
    ["Monday", "09:00", "19:00"],
    ["Tuesday", "09:00", "19:00"],
    ["Wednesday", "09:00", "19:00"],
    ["Thursday", "09:00", "20:00"],
    ["Friday", "09:00", "20:00"],
    ["Saturday", "09:00", "17:00"],
    ["Sunday", null, null]
  ],
  exceptions: [{ title: "Independence Day", value: "Closed" }]
});

export const FADE_SPEC: SiteSpec = {
  kind: "site_spec",
  version: 1,
  meta: {
    businessId: FADE_BUSINESS.businessId,
    brandName: "Prishtina Fade Co.",
    brandMark: "PF",
    locale: "en",
    seo: {
      title: "Prishtina Fade Co. — barbershop in Prishtina",
      description:
        "Skin fades, beard sculpting and hot-towel shaves, six days a week. Book in seconds."
    },
    generatedAt: STAMP,
    updatedAt: STAMP
  },
  design: {
    density: "regular",
    palette: {
      background: "#08080A",
      ink: "#F4F1EA",
      muted: "#8C877E",
      accent: "#E0A43C",
      accentInk: "#100E0B",
      line: "#FFFFFF21",
      soft: "#111114",
      panel: "#131317"
    },
    geometry: {
      radius: 2,
      radiusLg: 3,
      sectionPad: 64,
      sectionPadX: 46,
      gap: 30,
      colGap: 64,
      rule: 1
    },
    typography: {
      body: "system",
      display: "grotesk",
      displayWeight: 800,
      heroWeight: 840,
      tracking: -0.04,
      measure: 46
    },
    hero: { height: 600, mobileHeight: 520, measure: 660 },
    chrome: { nav: "square", navPosition: "edge", cta: "square", eyebrow: "caps" },
    art: { treatment: "cinematic", sequence: FADE_ART }
  },
  terminology: {
    primaryAction: "Book",
    services: "Services",
    team: "Team",
    gallery: "Work",
    hours: "Hours",
    story: "Story",
    reviews: "Reviews",
    contact: "Visit"
  },
  nav: {
    items: ["services", "team", "hours"],
    cta: { label: "Book", target: { kind: "booking" } }
  },
  sections: [
    {
      id: "hero",
      type: "hero",
      heading: {},
      variant: "full",
      eyebrow: "Prishtina · since 2019",
      headline: "Sharp fades.\nBooked in seconds.",
      body: "Skin fades, beard sculpting and hot-towel shaves. Six days a week, no waiting around.",
      primaryCta: { label: "Book an appointment", target: { kind: "booking" } },
      secondaryCta: { label: "See the cuts", target: { kind: "section", sectionId: "services" } },
      media: { kind: "generated", seed: 0 },
      accentRule: true
    },
    {
      id: "book-strip",
      type: "bookingStrip",
      heading: {},
      headline: "Booked in under a minute",
      sub: "Live from your SurroundChat calendar",
      cta: { label: "Book now", target: { kind: "booking" } }
    },
    {
      id: "services",
      type: "services",
      layout: "split",
      heading: {
        eyebrow: "The list",
        title: "Four cuts. Fixed prices.",
        sub: "No consultation fee, no upsell. What you see is what you pay at the chair."
      },
      presentation: "rows",
      selection: { mode: "all" },
      showPrices: true,
      showDurations: true,
      showDescriptions: false,
      withImages: false
    },
    {
      id: "team",
      type: "team",
      layout: "wide",
      heading: { eyebrow: "Behind the chair", title: "The people holding the clippers" },
      presentation: "overlay",
      selection: { mode: "all" },
      showRoles: true,
      portraits: {},
      ratio: "3/4"
    },
    {
      id: "hours",
      type: "hours",
      layout: "wide",
      heading: { eyebrow: "Hours", title: "Open six days" },
      presentation: "strip",
      noteStyle: "rule",
      showExceptions: true
    },
    {
      id: "booking",
      type: "booking",
      layout: "wide",
      heading: {
        eyebrow: "Appointments",
        title: "Pick a chair, pick a time",
        sub: "The same availability your assistant offers on WhatsApp."
      },
      presentation: "panel",
      cta: { label: "Book an appointment", target: { kind: "booking" } }
    },
    {
      id: "contact",
      type: "contact",
      layout: "flush",
      heading: {
        eyebrow: "Find us",
        title: { ref: "location.address" },
        sub: "Two minutes from Zahir Pajaziti square. Walk-ins taken when a chair is free."
      },
      presentation: "panel",
      showMap: true,
      showSocials: true,
      cta: { label: "Get directions", target: { kind: "directions" } }
    }
  ],
  footer: { presentation: "brand", note: "Stock photography via Pexels" },
  socials: [
    { label: "Instagram", url: "https://instagram.com/prishtinafade" },
    { label: "TikTok", url: "https://tiktok.com/@prishtinafade" }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Lumi Nails Studio — clean bright, gallery-forward, soft geometry
// ─────────────────────────────────────────────────────────────────────────────

export const LUMI_BUSINESS = buildBusiness({
  key: "lumi",
  businessName: "Lumi Nails Studio",
  address: "Rr. Fehmi Agani 8, Prishtina",
  phone: "+383 45 902 340",
  currency: "EUR",
  services: [
    {
      name: "Gel manicure",
      description: "Shaped, cuticle work and a gel colour of your choice.",
      priceCents: 1500,
      durationMin: 45
    },
    {
      name: "Nail art",
      description: "Hand-painted detail, per nail — from fine lines to full designs.",
      priceCents: 300,
      durationMin: 10
    },
    {
      name: "Spa pedicure",
      description: "Soak, exfoliation, massage and polish.",
      priceCents: 2000,
      durationMin: 60
    },
    {
      name: "Gel removal + refresh",
      description: "Safe soak-off and a fresh reshape.",
      priceCents: 1000,
      durationMin: 30
    }
  ],
  team: [{ name: "Lumi" }, { name: "Erza" }, { name: "Rina", soleServiceIndex: 1 }],
  hours: [
    ["Monday", "10:00", "18:00"],
    ["Tuesday", "10:00", "18:00"],
    ["Wednesday", "10:00", "18:00"],
    ["Thursday", "10:00", "20:00"],
    ["Friday", "10:00", "20:00"],
    ["Saturday", "10:00", "16:00"],
    ["Sunday", null, null]
  ]
});

export const LUMI_SPEC: SiteSpec = {
  kind: "site_spec",
  version: 1,
  meta: {
    businessId: LUMI_BUSINESS.businessId,
    brandName: "Lumi Nails Studio",
    brandMark: "LN",
    locale: "en",
    seo: {
      title: "Lumi Nails Studio — Prishtina",
      description: "Gel manicures, hand-painted nail art and spa pedicures in a calm studio."
    },
    generatedAt: STAMP,
    updatedAt: STAMP
  },
  design: {
    density: "regular",
    palette: {
      background: "#FFFCFB",
      ink: "#1F181B",
      muted: "#8A7C81",
      accent: "#B4547A",
      accentInk: "#FFFFFF",
      line: "#1F181B1A",
      soft: "#FBF3F5",
      panel: "#F7EDF0"
    },
    geometry: {
      radius: 16,
      radiusLg: 22,
      sectionPad: 58,
      sectionPadX: 36,
      gap: 26,
      colGap: 46,
      rule: 1
    },
    typography: {
      body: "system",
      display: "system-display",
      displayWeight: 600,
      heroWeight: 620,
      tracking: -0.03,
      measure: 50
    },
    hero: { height: 540, mobileHeight: 480, measure: 620 },
    chrome: { nav: "soft", navPosition: "edge", cta: "pill", eyebrow: "caps" },
    art: { treatment: "clean", sequence: LUMI_ART }
  },
  terminology: {
    primaryAction: "Book",
    services: "Menu",
    team: "Studio",
    gallery: "Our work",
    hours: "Hours",
    story: "About",
    reviews: "Reviews",
    contact: "Visit"
  },
  nav: {
    items: ["gallery", "services", "hours"],
    cta: { label: "Book", target: { kind: "booking" } }
  },
  sections: [
    {
      id: "hero",
      type: "hero",
      heading: {},
      variant: "split",
      eyebrow: "Nail studio · Prishtina",
      headline: "Nails worth\nphotographing.",
      body: "Gel manicures, hand-painted art and spa pedicures in a calm studio. Booking takes under a minute.",
      primaryCta: { label: "Book your appointment", target: { kind: "booking" } },
      secondaryCta: { label: "See our work", target: { kind: "section", sectionId: "gallery" } },
      media: { kind: "generated", seed: 0 },
      accentRule: false
    },
    {
      id: "gallery",
      type: "gallery",
      layout: "wide",
      heading: {
        eyebrow: "Our work",
        title: "Fresh from the studio",
        sub: "Every set below was done here, photographed the same day."
      },
      presentation: "mosaic",
      items: [
        { kind: "generated", seed: 1 },
        { kind: "generated", seed: 2 },
        { kind: "generated", seed: 3 },
        { kind: "generated", seed: 4 },
        { kind: "generated", seed: 5 },
        { kind: "generated", seed: 6 }
      ],
      captions: [],
      framing: {}
    },
    {
      id: "services",
      type: "services",
      layout: "wide",
      heading: { eyebrow: "Menu", title: "What we do, and what it costs" },
      presentation: "cards",
      selection: { mode: "all" },
      showPrices: true,
      showDurations: true,
      showDescriptions: true,
      withImages: true
    },
    {
      id: "booking",
      type: "booking",
      layout: "wide",
      heading: {
        eyebrow: "Booking",
        title: "Pick a time that suits you",
        sub: "The same availability your assistant offers on WhatsApp."
      },
      presentation: "panel",
      cta: { label: "Book your appointment", target: { kind: "booking" } }
    },
    {
      id: "hours",
      type: "hours",
      layout: "split",
      heading: { eyebrow: "Hours", title: "When you can find us" },
      presentation: "card",
      note: "Late nights Thursday and Friday until 20:00.",
      noteStyle: "info",
      showExceptions: true
    },
    {
      id: "contact",
      type: "contact",
      layout: "centered",
      heading: {
        eyebrow: "Come and see us",
        title: { ref: "location.address" },
        sub: "Second floor, above the bookshop. Ring the bell marked Lumi."
      },
      presentation: "center",
      showMap: true,
      showSocials: true,
      cta: { label: "Get directions", target: { kind: "directions" } }
    }
  ],
  footer: { presentation: "cta", ctaHeadline: "Ready for your next set?" },
  socials: [
    { label: "Instagram", url: "https://instagram.com/luminails" },
    { label: "Facebook", url: "https://facebook.com/luminails" }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Elegance Beauty Lounge — editorial serif, consultation-led, no gallery
// ─────────────────────────────────────────────────────────────────────────────

export const ELEGANCE_BUSINESS = buildBusiness({
  key: "eleg",
  businessName: "Elegance Beauty Lounge",
  address: "Rr. Luan Haradinaj 12, Prishtina",
  phone: "+383 44 771 205",
  currency: "EUR",
  services: [
    {
      name: "Signature facial",
      description: "Cleanse, exfoliation, extraction and a mask chosen for your skin on the day.",
      priceCents: 3500,
      durationMin: 60
    },
    {
      name: "Lash extensions — full set",
      description: "Classic or hybrid, applied lash by lash for a finish that grows out evenly.",
      priceCents: 4000,
      durationMin: 90
    },
    {
      name: "Bridal makeup",
      description: "Trial included, booked as a dedicated half-day so nothing is rushed.",
      priceCents: 8000,
      priceMode: "from",
      durationMin: 120
    },
    {
      name: "Full leg wax",
      description: "Warm wax with aftercare included.",
      priceCents: 2200,
      durationMin: 45
    }
  ],
  team: [
    { name: "Arta" },
    { name: "Vlora", soleServiceIndex: 1 },
    { name: "Nita", soleServiceIndex: 2 }
  ],
  hours: [
    ["Monday", null, null],
    ["Tuesday", "10:00", "19:00"],
    ["Wednesday", "10:00", "19:00"],
    ["Thursday", "10:00", "19:00"],
    ["Friday", "10:00", "19:00"],
    ["Saturday", "09:00", "16:00"],
    ["Sunday", null, null]
  ]
});

export const ELEGANCE_SPEC: SiteSpec = {
  kind: "site_spec",
  version: 1,
  meta: {
    businessId: ELEGANCE_BUSINESS.businessId,
    brandName: "Elegance Beauty Lounge",
    brandMark: "EB",
    locale: "en",
    seo: {
      title: "Elegance Beauty Lounge — Prishtina",
      description:
        "Facials, lashes, waxing and bridal makeup from a small team that books one client at a time."
    },
    generatedAt: STAMP,
    updatedAt: STAMP
  },
  design: {
    density: "spacious",
    palette: {
      background: "#FCFAF6",
      ink: "#211A1F",
      muted: "#7E7379",
      accent: "#6E4A63",
      accentInk: "#FFFFFF",
      line: "#211A1F21",
      soft: "#F4EDE7",
      panel: "#F0E8E1"
    },
    geometry: {
      radius: 0,
      radiusLg: 0,
      sectionPad: 72,
      sectionPadX: 48,
      gap: 32,
      colGap: 64,
      rule: 1
    },
    typography: {
      body: "system",
      display: "serif",
      displayWeight: 400,
      heroWeight: 400,
      tracking: -0.022,
      measure: 52
    },
    hero: { height: 560, mobileHeight: 460, measure: 640 },
    chrome: { nav: "rule", navPosition: "center", cta: "rule", eyebrow: "serif" },
    art: { treatment: "editorial", sequence: ELEGANCE_ART }
  },
  terminology: {
    primaryAction: "Book",
    services: "Treatments",
    team: "Practitioners",
    gallery: "Work",
    hours: "Hours",
    story: "Our story",
    reviews: "Reviews",
    contact: "Visit"
  },
  nav: {
    items: ["story", "services", "team", "reviews"],
    cta: { label: "Book", target: { kind: "booking" } }
  },
  sections: [
    {
      id: "hero",
      type: "hero",
      heading: {},
      variant: "editorial",
      eyebrow: "Beauty lounge · since 2016",
      headline: "Considered beauty,\nwithout the rush.",
      body: "Facials, lashes, waxing and bridal makeup, delivered by a small team that books one client at a time.",
      primaryCta: { label: "Book a consultation", target: { kind: "booking" } },
      secondaryCta: { label: "View treatments", target: { kind: "section", sectionId: "services" } },
      media: { kind: "generated", seed: 0 },
      accentRule: false,
      bandCaption: "The treatment room, Rr. Luan Haradinaj — photographed for us in spring."
    },
    {
      id: "story",
      type: "story",
      layout: "stack",
      heading: { eyebrow: "Our story", title: "A small team, a long list of regulars" },
      presentation: "pullquote",
      quote:
        "We opened in 2016 with one treatment room and a waiting list. We still take one client at a time, still finish on schedule, and still talk you out of the treatment you asked for when a different one will serve you better.",
      attribution: "Arta Krasniqi · founder",
      stats: [
        { value: "2016", label: "Opened" },
        { value: "1", label: "Client at a time" },
        { value: "4", label: "Practitioners" }
      ]
    },
    {
      id: "services",
      type: "services",
      layout: "edge",
      heading: {
        eyebrow: "Treatments",
        title: "Priced by the time they honestly take",
        sub: "Every treatment below includes the consultation. Nothing is sold on the day."
      },
      presentation: "editorial",
      selection: { mode: "all" },
      showPrices: true,
      showDurations: true,
      showDescriptions: true,
      withImages: false
    },
    {
      id: "team",
      type: "team",
      layout: "stack",
      heading: { eyebrow: "The practitioners", title: "Who you'll be booked with" },
      presentation: "editorial",
      selection: { mode: "all" },
      showRoles: true,
      portraits: {},
      ratio: "4/5"
    },
    {
      id: "booking",
      type: "booking",
      layout: "centered",
      heading: {
        eyebrow: "Appointments",
        title: "Book a consultation first",
        sub: "We start every new client with a short consultation so the treatment is chosen for your skin, not from a menu."
      },
      presentation: "plain",
      cta: { label: "Book a consultation", target: { kind: "booking" } }
    },
    {
      id: "reviews",
      type: "reviews",
      layout: "centered",
      heading: { eyebrow: "In their words", title: "What clients say" },
      presentation: "empty",
      items: []
    },
    {
      id: "contact",
      type: "contact",
      layout: "wide",
      heading: { eyebrow: "Visit", title: { ref: "location.address" } },
      presentation: "stack",
      showMap: true,
      showSocials: true
    }
  ],
  footer: {
    presentation: "editorial",
    ctaHeadline: "One client at a time, by appointment."
  },
  socials: [
    { label: "Instagram", url: "https://instagram.com/elegancebeauty" },
    { label: "Pinterest", url: "https://pinterest.com/elegancebeauty" }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Lens & Light Studio — photographic dark, portfolio-first, enquiry not booking
// ─────────────────────────────────────────────────────────────────────────────

export const LENS_BUSINESS = buildBusiness({
  key: "lens",
  businessName: "Lens & Light Studio",
  address: "Studio 4, Rr. Agim Ramadani, Prishtina",
  phone: "+383 49 118 662",
  currency: "EUR",
  bookingState: "legacy",
  services: [
    {
      name: "Wedding — full day",
      description:
        "Two photographers, full-day coverage, 600+ edited frames delivered in six weeks.",
      priceCents: 90000,
      priceMode: "from",
      durationMin: 600
    },
    {
      name: "Wedding — ceremony",
      description: "Ceremony and portraits, one photographer.",
      priceCents: 45000,
      priceMode: "from",
      durationMin: 240
    },
    {
      name: "Portrait session",
      description: "Studio or location, 25 edited frames.",
      priceCents: 15000,
      durationMin: 90
    },
    {
      name: "Engagement shoot",
      description: "A location of your choosing, 40 edited frames.",
      priceCents: 18000,
      durationMin: 120
    }
  ],
  team: [{ name: "Endrit" }, { name: "Sara" }, { name: "Blend", soleServiceIndex: 2 }],
  hours: [
    ["Monday", "10:00", "18:00"],
    ["Tuesday", "10:00", "18:00"],
    ["Wednesday", "10:00", "18:00"],
    ["Thursday", "10:00", "18:00"],
    ["Friday", "10:00", "18:00"],
    ["Saturday", null, null],
    ["Sunday", null, null]
  ]
});

export const LENS_SPEC: SiteSpec = {
  kind: "site_spec",
  version: 1,
  meta: {
    businessId: LENS_BUSINESS.businessId,
    brandName: "Lens & Light Studio",
    brandMark: "LL",
    locale: "en",
    seo: {
      title: "Lens & Light Studio — documentary photography",
      description: "Documentary wedding and portrait photography. Small crew, honest pictures."
    },
    generatedAt: STAMP,
    updatedAt: STAMP
  },
  design: {
    density: "regular",
    palette: {
      background: "#0B0C0E",
      ink: "#EDE9E1",
      muted: "#8B867F",
      accent: "#E9E4DA",
      accentInk: "#0B0C0E",
      line: "#FFFFFF26",
      soft: "#141518",
      panel: "#16171A"
    },
    geometry: {
      radius: 0,
      radiusLg: 0,
      sectionPad: 64,
      sectionPadX: 40,
      gap: 26,
      colGap: 56,
      rule: 1
    },
    typography: {
      body: "mono",
      display: "system-display",
      displayWeight: 560,
      heroWeight: 560,
      tracking: -0.03,
      measure: 42
    },
    hero: { height: 680, mobileHeight: 560, measure: 600 },
    chrome: { nav: "rule", navPosition: "edge", cta: "square", eyebrow: "mono" },
    art: { treatment: "photographic", sequence: LENS_ART }
  },
  terminology: {
    primaryAction: "Enquire",
    services: "Packages",
    team: "Crew",
    gallery: "Work",
    hours: "Studio",
    story: "Approach",
    reviews: "Words",
    contact: "Studio"
  },
  nav: {
    items: ["gallery", "story", "services"],
    cta: { label: "Enquire", target: { kind: "enquiry" } }
  },
  sections: [
    {
      id: "hero",
      type: "hero",
      heading: {},
      variant: "full",
      eyebrow: "Weddings · portraits · Prishtina",
      headline: "Light, held still.",
      body: "Documentary wedding and portrait photography. Small crew, long days, honest pictures.",
      primaryCta: { label: "Check your date", target: { kind: "enquiry" } },
      secondaryCta: { label: "View portfolio", target: { kind: "section", sectionId: "gallery" } },
      media: { kind: "generated", seed: 0 },
      accentRule: false
    },
    {
      id: "gallery",
      type: "gallery",
      layout: "wide",
      heading: { eyebrow: "Selected work", title: "Twelve weddings, one winter" },
      presentation: "portfolio",
      items: [
        { kind: "generated", seed: 1 },
        { kind: "generated", seed: 2 },
        { kind: "generated", seed: 3 },
        { kind: "generated", seed: 4 },
        { kind: "generated", seed: 5 }
      ],
      captions: [
        "Nita & Bledi — Gjakovë, October",
        "Studio portrait — 85mm",
        "First look — Rugova",
        "Reception — Prishtina",
        "Detail — the ring box"
      ],
      framing: {}
    },
    {
      id: "story",
      type: "story",
      layout: "split",
      heading: { eyebrow: "Approach", title: "We shoot the day as it happens" },
      presentation: "column",
      body: "No stiff line-ups, no shot list you have to perform. We stay close, stay quiet, and bring back the day you actually had — the speeches, the crying aunt, the last dance.",
      stats: []
    },
    {
      id: "services",
      type: "services",
      layout: "wide",
      heading: { eyebrow: "Packages", title: "What a booking includes" },
      presentation: "packages",
      selection: { mode: "all" },
      showPrices: true,
      showDurations: true,
      showDescriptions: true,
      withImages: false
    },
    {
      id: "enquiry",
      type: "enquiry",
      layout: "wide",
      heading: {
        eyebrow: "Enquiries",
        title: "Tell us about your date",
        sub: "Every enquiry lands in your SurroundChat inbox. We answer within 48 hours."
      },
      presentation: "invert",
      fields: [
        { name: "name", label: "Your name", required: true },
        { name: "email", label: "Email", required: true },
        { name: "message", label: "Where and when is it happening?", required: true }
      ],
      cta: { label: "Send enquiry", target: { kind: "enquiry" } }
    },
    {
      id: "contact",
      type: "contact",
      layout: "wide",
      heading: {
        eyebrow: "Studio",
        title: { ref: "location.address" },
        sub: "Studio 4, third floor. Visits by appointment — we are usually out shooting."
      },
      presentation: "split",
      showMap: true,
      showSocials: true,
      cta: { label: "Get directions", target: { kind: "directions" } }
    }
  ],
  footer: { presentation: "minimal", note: "Stock photography via Pexels" },
  socials: [
    { label: "Instagram", url: "https://instagram.com/lensandlight" },
    { label: "Behance", url: "https://behance.net/lensandlight" }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────

export const FIXTURES = [
  { key: "fade", label: "Prishtina Fade Co.", spec: FADE_SPEC, business: FADE_BUSINESS },
  { key: "lumi", label: "Lumi Nails Studio", spec: LUMI_SPEC, business: LUMI_BUSINESS },
  { key: "elegance", label: "Elegance Beauty Lounge", spec: ELEGANCE_SPEC, business: ELEGANCE_BUSINESS },
  { key: "lens", label: "Lens & Light Studio", spec: LENS_SPEC, business: LENS_BUSINESS }
] as const;
