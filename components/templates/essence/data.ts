export type EssenceNavItem = { label: string; href: string };

export type EssencePrinciple = {
  number: string;
  title: string;
  description: string;
};

export type EssenceExperienceStep = {
  course: string;
  timing: string;
  title: string;
  description: string;
  details: string[];
};

export type EssenceDish = {
  id: string;
  name: string;
  subtitle: string;
  season: string;
  description: string;
  technique: string;
  image: string;
  awards: string[];
};

export type EssenceTemplateData = {
  brand: string;
  logoUrl?: string | null;
  header: {
    navItems: EssenceNavItem[];
    ctaLabel: string;
    ctaHref: string;
  };
  hero: {
    eyebrow: string;
    headline: [string, string, string];
    description: string;
    ctaLabel: string;
    ctaHref: string;
    heroImage: string;
    heroAlt: string;
    coordinates: string[];
  };
  vision: {
    heading: string;
    paragraphs: string[];
    stats: Array<{ value: string; label: string }>;
  };
  philosophy: {
    heading: string;
    principles: EssencePrinciple[];
    image: string;
    imageAlt: string;
    imageCaption: string;
  };
  experience: {
    heading: string;
    description: string;
    image: string;
    imageAlt: string;
    steps: EssenceExperienceStep[];
  };
  dishes: {
    heading: string;
    note: string;
    dishes: EssenceDish[];
  };
  contact: {
    heading: string;
    description: string;
    restaurantAddress: string[];
    reservationEmail: string;
    phone: string;
    hours: string[];
    socialLinks: Array<{ label: string; href: string }>;
    fields: {
      nameLabel: string;
      emailLabel: string;
      phoneLabel: string;
      dateLabel: string;
      guestsLabel: string;
      messageLabel: string;
      submitLabel: string;
      placeholders: {
        name: string;
        email: string;
        phone: string;
        guests: string;
        message: string;
      };
      guestOptions: Array<{ value: string; label: string }>;
    };
  };
  footer: {
    description: string;
    restaurantLinks: EssenceNavItem[];
    legalLinks: string[];
    contactAddress: string[];
    contactEmail: string;
    contactPhone: string;
    socialLinks: Array<{ label: string; href: string }>;
    decorativeQuote: string;
  };
};

export const essenceData: EssenceTemplateData = {
  brand: "ESSENCE",
  header: {
    navItems: [
      { label: "Vision", href: "#vision" },
      { label: "Philosophy", href: "#philosophy" },
      { label: "Experience", href: "#experience" },
      { label: "Signature", href: "#dishes" },
      { label: "Reservations", href: "#contact" }
    ],
    ctaLabel: "Reserve",
    ctaHref: "#contact"
  },
  hero: {
    eyebrow: "Since 2012",
    headline: ["Culinary artistry", "that transcends", "the plate"],
    description:
      "Three Michelin stars celebrating the precision of French technique, the purity of seasonal ingredients, and the poetry of each moment.",
    ctaLabel: "Discover Our Cuisine",
    ctaHref: "#dishes",
    heroImage: "/templates/essence/hero.jpg",
    heroAlt: "Chef meticulously plating haute cuisine in a minimalist kitchen",
    coordinates: ["47.6062° N", "122.3321° W"]
  },
  vision: {
    heading:
      "We believe cuisine should disappear—leaving only the emotion, the memory, the moment when taste transcends the plate.",
    paragraphs: [
      "For over a decade, we've crafted dining experiences that respond to the rhythm of the seasons—the first asparagus of spring, the depth of autumn truffles, the purity of winter citrus.",
      "Our work isn't about culinary statements. It's about creating moments where you feel most present—meals that linger in memory and transform how you understand flavor."
    ],
    stats: [
      { value: "12", label: "Years of Excellence" },
      { value: "3", label: "Michelin Stars" },
      { value: "24", label: "Seasonal Menus" },
      { value: "100+", label: "Signature Creations" }
    ]
  },
  philosophy: {
    heading: "Four principles that guide every dish we create",
    principles: [
      {
        number: "01",
        title: "Ingredient as Foundation",
        description:
          "Every dish begins with sourcing. We work with farmers, foragers, and artisans who share our reverence for quality. The ingredient teaches us what the dish should become."
      },
      {
        number: "02",
        title: "Technique as Language",
        description:
          "We honor French foundations while embracing innovation. Sous-vide precision, fermentation depth, classical sauces reimagined—technique serves expression, never overshadows it."
      },
      {
        number: "03",
        title: "Seasonality Over Trend",
        description:
          "Fashion fades. We compose menus that celebrate the moment—spring peas at their sweetest, summer stone fruit at peak, autumn game in its glory. Nature dictates our rhythm."
      },
      {
        number: "04",
        title: "Memory as Measure",
        description:
          "Cuisine exists to create lasting impressions. Every flavor combination, every textural contrast, every visual composition is calibrated to leave an indelible mark on your palate and memory."
      }
    ],
    image: "/templates/essence/kitchen-1.jpg",
    imageAlt: "Chef preparing fresh ingredients in the ESSENCE kitchen",
    imageCaption: "Our kitchen — Where passion meets precision"
  },
  experience: {
    heading: "An evening orchestrated across four movements",
    description:
      "Our tasting menu is a journey through twelve to sixteen courses, designed to unfold over three hours. Each dish builds upon the last, creating a narrative arc that celebrates the season.",
    image: "/templates/essence/plating-1.jpg",
    imageAlt: "Chef carefully plating a signature dish with precision",
    steps: [
      {
        course: "Aperitif",
        timing: "Arrival",
        title: "The Welcoming",
        description:
          "Your evening begins in our lounge with a signature cocktail and amuse-bouche. A moment to transition from the outside world into our culinary universe.",
        details: ["Seasonal cocktail", "Two amuse-bouche", "Bread service begins", "Menu presentation"]
      },
      {
        course: "Entrées",
        timing: "First Act",
        title: "Awakening the Palate",
        description:
          "Three to four opening courses that introduce the evening's themes. Delicate preparations that tease and intrigue, building anticipation for what follows.",
        details: ["Raw preparations", "Garden vegetables", "Seafood expressions", "Intermezzo"]
      },
      {
        course: "Plats Principaux",
        timing: "The Heart",
        title: "Peak Experience",
        description:
          "The centerpiece courses where technique, ingredient, and vision converge. This is where the menu reaches its emotional and gustatory crescendo.",
        details: ["Fish or seafood", "Poultry or game", "Signature preparations", "Seasonal highlights"]
      },
      {
        course: "Desserts",
        timing: "The Finale",
        title: "Sweet Contemplation",
        description:
          "A progression of desserts that provide resolution and reflection. From pre-dessert through final mignardises, a gentle descent that completes the narrative.",
        details: ["Pre-dessert", "Main dessert", "Cheese service option", "Petit fours & mignardises"]
      }
    ]
  },
  dishes: {
    heading: "Creations that have defined our culinary voice",
    note:
      "Our menu changes with the seasons. These signature dishes represent our philosophy, but each visit brings new expressions of the moment.",
    dishes: [
      {
        id: "scallops",
        name: "Diver Scallops",
        subtitle: "Pea Purée, Micro Greens, Edible Flowers",
        season: "Spring",
        description:
          "Hand-dived scallops from the cold waters of Hokkaido, seared to translucent perfection. Accompanied by sweet pea purée, young shoots, and delicate blossoms that capture the essence of renewal.",
        technique: "Precision searing, vegetable emulsion",
        image: "/templates/essence/dish-2.jpg",
        awards: ["Best Seafood Dish 2024"]
      },
      {
        id: "oyster",
        name: "Oyster & Caviar",
        subtitle: "Champagne Foam, Yuzu, Sea Herbs",
        season: "Year-Round",
        description:
          "A study in oceanic luxury. Brittany oyster topped with Ossetra caviar, enrobed in champagne foam with a whisper of yuzu. The sea, distilled to its most elegant expression.",
        technique: "Molecular gastronomy, foam stabilization",
        image: "/templates/essence/dish-1.jpg",
        awards: ["Signature Dish Award"]
      },
      {
        id: "cod",
        name: "Black Cod",
        subtitle: "Miso Glaze, Seasonal Vegetables, Herb Oil",
        season: "Autumn",
        description:
          "Wild-caught Alaskan black cod, marinated for 48 hours in white miso and mirin. The fish achieves an impossibly silky texture, complemented by roasted root vegetables and aromatic herb essence.",
        technique: "Extended marination, precision roasting",
        image: "/templates/essence/dish-3.jpg",
        awards: []
      }
    ]
  },
  contact: {
    heading: "Reserve your table for an unforgettable evening",
    description:
      "Our intimate dining room seats just thirty-two guests per evening. Reservations are highly recommended and open three months in advance.",
    restaurantAddress: ["428 rue Saint-Honoré", "75001 Paris, France"],
    reservationEmail: "reserve@essence-paris.fr",
    phone: "+33 1 42 60 80 80",
    hours: ["Tuesday – Saturday", "Dinner: 19:00 & 21:30", "Closed Sunday & Monday"],
    socialLinks: [
      { label: "Instagram", href: "#" },
      { label: "La Liste", href: "#" },
      { label: "Michelin Guide", href: "#" }
    ],
    fields: {
      nameLabel: "Name",
      emailLabel: "Email",
      phoneLabel: "Phone",
      dateLabel: "Preferred Date",
      guestsLabel: "Number of Guests",
      messageLabel: "Special Requests (optional)",
      submitLabel: "Request Reservation",
      placeholders: {
        name: "Your name",
        email: "your@email.com",
        phone: "+__ ___ ___ ___",
        guests: "Select number of guests",
        message: "Dietary restrictions, allergies, special occasions, or other requests..."
      },
      guestOptions: [
        { value: "1", label: "1 guest" },
        { value: "2", label: "2 guests" },
        { value: "3", label: "3 guests" },
        { value: "4", label: "4 guests" },
        { value: "5", label: "5 guests" },
        { value: "6", label: "6 guests" },
        { value: "7+", label: "7+ guests (please inquire)" }
      ]
    }
  },
  footer: {
    description:
      "Three-Michelin-star restaurant celebrating the art of French haute cuisine with modern sensibility. Located in the heart of Paris.",
    restaurantLinks: [
      { label: "Vision", href: "#vision" },
      { label: "Philosophy", href: "#philosophy" },
      { label: "Experience", href: "#experience" },
      { label: "Signature Dishes", href: "#dishes" },
      { label: "Reservations", href: "#contact" }
    ],
    legalLinks: ["Privacy Policy", "Terms of Service", "Accessibility"],
    contactAddress: ["428 rue Saint-Honoré", "75001 Paris, France"],
    contactEmail: "reserve@essence-paris.fr",
    contactPhone: "+33 1 42 60 80 80",
    socialLinks: [
      { label: "Instagram", href: "#" },
      { label: "La Liste", href: "#" },
      { label: "Michelin Guide", href: "#" }
    ],
    decorativeQuote: "Cuisine is the art that nourishes both body and soul."
  }
};
