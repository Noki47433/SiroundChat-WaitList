export type HouslyNavItem = {
  label: string;
  href: string;
};

export type HouslyPhilosophyItem = {
  title: string;
  description: string;
};

export type HouslyHighlight = {
  id: number;
  title: string;
  category: string;
  detail: string;
  image: string;
};

export type HouslyExperienceItem = {
  title: string;
  description: string;
  icon: "utensils" | "calendar" | "users" | "leaf";
};

export type HouslyFaqItem = {
  question: string;
  answer: string;
};

export type HouslyTemplateData = {
  brand: string;
  logoUrl?: string | null;
  header: {
    navItems: HouslyNavItem[];
    ctaLabel: string;
    ctaHref: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    accentTitle: string;
    description: string;
    backgroundImage: string;
    foregroundImage: string;
    backgroundAlt: string;
    foregroundAlt: string;
  };
  philosophy: {
    sectionLabel: string;
    title: string;
    accent: string;
    description: string;
    image: string;
    imageAlt: string;
    items: HouslyPhilosophyItem[];
  };
  highlights: {
    sectionLabel: string;
    title: string;
    ctaLabel: string;
    ctaHref: string;
    items: HouslyHighlight[];
  };
  experience: {
    sectionLabel: string;
    title: string;
    accent: string;
    description: string;
    items: HouslyExperienceItem[];
  };
  faq: {
    sectionLabel: string;
    title: string;
    items: HouslyFaqItem[];
  };
  reservation: {
    sectionLabel: string;
    title: string;
    accent: string;
    description: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
  footer: {
    description: string;
    navigationTitle: string;
    navigationItems: HouslyNavItem[];
    contactTitle: string;
    email: string;
    phone: string;
    links: Array<{ label: string; href: string }>;
    legal: string[];
  };
};

export const houslyData: HouslyTemplateData = {
  brand: "EMBER",
  header: {
    navItems: [
      { label: "Home", href: "#hero" },
      { label: "Philosophy", href: "#about" },
      { label: "Spaces", href: "#highlights" },
      { label: "Experience", href: "#experience" },
      { label: "FAQ", href: "#faq" }
    ],
    ctaLabel: "Reserve table",
    ctaHref: "#contact"
  },
  hero: {
    eyebrow: "Seasonal dining house",
    title: "We shape evenings",
    accentTitle: "worth lingering over",
    description:
      "A modern restaurant built around quiet hospitality, ingredient-led plates, and rooms that feel warm from lunch through late dinner.",
    backgroundImage: "/templates/hously/hously-background.png",
    foregroundImage: "/templates/hously/hously-foreground.png",
    backgroundAlt: "Minimal restaurant interior with dramatic light and dark paneling",
    foregroundAlt: "Marble chef counter in the foreground of the dining room"
  },
  philosophy: {
    sectionLabel: "Our philosophy",
    title: "Dining with",
    accent: "intention",
    description:
      "Every detail is reduced to what matters most: the room, the plate, the pace of service, and the feeling guests take with them when the evening ends.",
    image: "/templates/hously/hously-3.png",
    imageAlt: "Sunlit restaurant dining room with a sculptural table and soft seating",
    items: [
      {
        title: "Ingredient-led menu",
        description:
          "Seasonal produce, careful sourcing, and concise plates let each ingredient speak clearly without distraction."
      },
      {
        title: "Room for ritual",
        description:
          "From the first glass to the final course, the flow of the room is designed to feel calm, tactile, and easy to settle into."
      },
      {
        title: "Quiet hospitality",
        description:
          "Service is precise and warm. Present when needed, invisible when it should be, and always tuned to the table."
      },
      {
        title: "Details that linger",
        description:
          "Texture, light, sound, and spacing are treated like part of the menu so the entire experience feels cohesive."
      }
    ]
  },
  highlights: {
    sectionLabel: "Selected highlights",
    title: "Signature spaces",
    ctaLabel: "See the full dining experience",
    ctaHref: "#experience",
    items: [
      {
        id: 1,
        title: "Aperitivo Lounge",
        category: "Before dinner",
        detail: "Cocktails · Small plates",
        image: "/templates/hously/hously-1.png"
      },
      {
        id: 2,
        title: "Sommelier Library",
        category: "Private moments",
        detail: "Wine pairings · Quiet conversations",
        image: "/templates/hously/hously-2.png"
      },
      {
        id: 3,
        title: "Main Dining Room",
        category: "All-day service",
        detail: "Lunch light · Long dinners",
        image: "/templates/hously/hously-3.png"
      },
      {
        id: 4,
        title: "Chef's Counter",
        category: "Front-row dining",
        detail: "Open kitchen · Tasting seats",
        image: "/templates/hously/hously-4.png"
      }
    ]
  },
  experience: {
    sectionLabel: "Dining experience",
    title: "Hospitality",
    accent: "refined through service",
    description:
      "The menu, the room, and the pace are designed together so the visit feels consistent from the first arrival to the last course.",
    items: [
      {
        title: "Seasonal tasting menu",
        description:
          "A focused progression of plates built around produce at its peak, with concise compositions and confident flavor.",
        icon: "utensils"
      },
      {
        title: "Private dining",
        description:
          "Smaller celebrations, team dinners, and tasting events hosted in quieter spaces with dedicated service.",
        icon: "users"
      },
      {
        title: "Concierge reservations",
        description:
          "Simple table booking for lunch, dinner, chef's counter seating, and curated experiences during the week.",
        icon: "calendar"
      },
      {
        title: "Producer-driven sourcing",
        description:
          "Menus shift with farmers, fishers, and makers who define the flavor and rhythm of each season.",
        icon: "leaf"
      }
    ]
  },
  faq: {
    sectionLabel: "FAQ",
    title: "Questions & Answers",
    items: [
      {
        question: "Do you accept walk-ins?",
        answer:
          "We keep a limited number of seats available for walk-ins each service, but reservations are recommended for dinner and chef's counter seating."
      },
      {
        question: "Is there a tasting menu?",
        answer:
          "Yes. Our tasting menu changes regularly with the season and is available alongside a shorter a la carte selection on select services."
      },
      {
        question: "Can you accommodate dietary restrictions?",
        answer:
          "We can adapt many dishes with advance notice. Please include allergies and dietary needs when requesting your table."
      },
      {
        question: "Do you host private dinners or events?",
        answer:
          "Yes. We offer intimate private dining and partial buyouts for celebrations, brand dinners, and team gatherings."
      },
      {
        question: "When do reservations open?",
        answer:
          "Reservations open on a rolling basis four weeks ahead. We also release a small number of late cancellations the day of service."
      },
      {
        question: "What should we expect from the atmosphere?",
        answer:
          "The room is relaxed, design-forward, and calm. Think warm light, restrained music, attentive service, and an unhurried pace."
      }
    ]
  },
  reservation: {
    sectionLabel: "Reserve a table",
    title: "Ready for an evening",
    accent: "that stays with you?",
    description:
      "Book lunch, dinner, or chef's counter seating. We'll follow up with availability and any details needed for your table.",
    primaryLabel: "Request a reservation",
    primaryHref: "mailto:reservations@ember-house.com",
    secondaryLabel: "Call the host",
    secondaryHref: "tel:+33142608080"
  },
  footer: {
    description:
      "A modern restaurant shaped by seasonal cooking, warm service, and quiet interiors designed for long lunches and late dinners.",
    navigationTitle: "Restaurant",
    navigationItems: [
      { label: "Philosophy", href: "#about" },
      { label: "Spaces", href: "#highlights" },
      { label: "Experience", href: "#experience" },
      { label: "Reservations", href: "#contact" }
    ],
    contactTitle: "Connect",
    email: "reservations@ember-house.com",
    phone: "+33 1 42 60 80 80",
    links: [
      { label: "Instagram", href: "#" },
      { label: "Map", href: "#" },
      { label: "Journal", href: "#" }
    ],
    legal: ["Privacy", "Terms"]
  }
};
