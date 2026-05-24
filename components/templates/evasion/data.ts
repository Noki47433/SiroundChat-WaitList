export type EvasionMedia = {
  src: string;
  alt: string;
};

export type EvasionProductCard = {
  title: string;
  description: string;
  image: string;
  eyebrow?: string;
  price?: string;
  detail?: string;
};

export type EvasionFooterColumn = {
  title: string;
  links: Array<{ label: string; href: string }>;
};

export type EvasionTemplateData = {
  brand: string;
  logoUrl?: string | null;
  header: {
    navItems: Array<{ label: string; href: string }>;
    ctaLabel: string;
    ctaHref: string;
  };
  hero: {
    word: string;
    mainImage: EvasionMedia;
    sideImages: Array<EvasionMedia & { position: "left" | "right" }>;
    tagline: string;
    supportingLines?: string[];
  };
  philosophy: {
    heading: string;
    description: string;
    paragraphs?: string[];
    products: Array<{
      name: string;
      price: string;
      image: EvasionMedia;
    }>;
  };
  featuredProducts: {
    title: string;
    subtitle: string;
    items: EvasionProductCard[];
  };
  technology: {
    titleWords: string[];
    centerImage: EvasionMedia;
    sideImages: Array<EvasionMedia & { position: "left" | "right" }>;
    description: string;
    supportingItems?: Array<{ title: string; description: string }>;
  };
  gallery: {
    images: EvasionMedia[];
  };
  accessories: {
    title: string;
    items: EvasionProductCard[];
  };
  editorial: {
    intro?: string;
    specs: Array<{ label: string; value: string }>;
    videoUrl: string;
  };
  testimonial: {
    quote: string;
    image: EvasionMedia;
  };
  reservation: {
    eyebrow: string;
    title: string;
    description: string;
    buttonLabel: string;
    buttonHref: string;
  };
  footer: {
    description: string;
    columns: EvasionFooterColumn[];
    legalText: string;
    socials: Array<{ label: string; href: string }>;
  };
};

export const evasionData: EvasionTemplateData = {
  brand: "EVASION",
  header: {
    navItems: [
      { label: "Products", href: "#products" },
      { label: "Technology", href: "#technology" },
      { label: "Gallery", href: "#gallery" },
      { label: "Accessories", href: "#accessories" }
    ],
    ctaLabel: "Buy the product",
    ctaHref: "#reserve"
  },
  hero: {
    word: "EVASION",
    mainImage: {
      src: "/templates/evasion/hero-main.png",
      alt: "Mountain landscape with a tent at sunset"
    },
    sideImages: [
      {
        src: "https://images.unsplash.com/photo-1517824806704-9040b037703b?q=80&w=1200&auto=format&fit=crop",
        alt: "Mountain hiking adventure",
        position: "left"
      },
      {
        src: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=1200&auto=format&fit=crop",
        alt: "Camping under the stars",
        position: "left"
      },
      {
        src: "https://images.unsplash.com/photo-1533873984035-25970ab07461?q=80&w=1200&auto=format&fit=crop",
        alt: "Forest exploration",
        position: "right"
      },
      {
        src: "https://images.unsplash.com/photo-1527004013197-933c4bb611b3?q=80&w=1200&auto=format&fit=crop",
        alt: "Lake camping view",
        position: "right"
      }
    ],
    tagline: "Lightweight, durable and adventure-ready."
  },
  philosophy: {
    heading: "Meet Alpine & Forest.",
    description:
      "Alpine & Forest are high-tech outdoor accessories designed for modern adventurers. Lightweight, durable, and engineered for extreme conditions.",
    products: [
      {
        name: "Alpine",
        price: "$299",
        image: {
          src: "/templates/evasion/product-backpack.png",
          alt: "Alpine product in a mountain setting"
        }
      },
      {
        name: "Forest",
        price: "$199",
        image: {
          src: "/templates/evasion/02cdc426-dff4-4dff-b131-1b134c3699b5.png",
          alt: "Forest product in a woodland setting"
        }
      }
    ]
  },
  featuredProducts: {
    title: "Engineered for Excellence.",
    subtitle: "Designed for Adventure.",
    items: [
      {
        title: "Smart Temperature Control",
        description: "Innovation",
        image: "/templates/evasion/d18fe616-5596-4559-90f5-a90f5397d0d8.png"
      },
      {
        title: "Ultra-Light Carbon Frame",
        description: "Performance",
        image: "/templates/evasion/e26fa9c3-966d-4966-94a4-954a1e511c1c.png"
      },
      {
        title: "Weather-Resistant Design",
        description: "Durability",
        image: "/templates/evasion/car.jpg"
      },
      {
        title: "Adventure-Tested Carry System",
        description: "Mobility",
        image: "/templates/evasion/product-backpack.png"
      },
      {
        title: "Built-In LED Flashlight",
        description: "Visibility",
        image: "/templates/evasion/led-flashlight-bottle.png"
      },
      {
        title: "Immersive Campfire Finish",
        description: "Atmosphere",
        image: "/templates/evasion/3d4046a0-b072-4b07-941f-9141ee3ed4a7.png"
      }
    ]
  },
  technology: {
    titleWords: ["Technology", "Meets", "Wilderness."],
    centerImage: {
      src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
      alt: "Wilderness ridge at dusk"
    },
    sideImages: [
      {
        src: "https://images.unsplash.com/photo-1476610182048-b716b8518aae?q=80&w=1200&auto=format&fit=crop",
        alt: "Forest trail",
        position: "left"
      },
      {
        src: "https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?q=80&w=1200&auto=format&fit=crop",
        alt: "Mountain peak",
        position: "left"
      },
      {
        src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=1200&auto=format&fit=crop",
        alt: "Alpine landscape",
        position: "right"
      },
      {
        src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop",
        alt: "Snow mountain",
        position: "right"
      }
    ],
    description:
      "Experience outdoor gear reimagined with cutting-edge technology. EVASION combines ultra-lightweight materials, intelligent temperature control, and weather-resistant engineering to elevate every adventure."
  },
  gallery: {
    images: [
      { src: "/templates/evasion/bottle-bike.png", alt: "Thermal bottle mounted on a bicycle" },
      { src: "/templates/evasion/bottle-lake.png", alt: "Bottle by a lake at sunset" },
      { src: "/templates/evasion/bottle-water.png", alt: "Bottle in flowing water" },
      { src: "/templates/evasion/bottle-stream.png", alt: "Bottle beside a mountain stream" },
      { src: "/templates/evasion/bottle-fire.png", alt: "Bottle beside a campfire" },
      { src: "/templates/evasion/bottle-snow.png", alt: "Bottle in snow" },
      { src: "/templates/evasion/bottle-mountain.png", alt: "Bottle on a mountain ridge" },
      { src: "/templates/evasion/bottle-canyon.png", alt: "Bottle overlooking a canyon" }
    ]
  },
  accessories: {
    title: "Essential Accessories",
    items: [
      {
        title: "Wireless Charging Stand",
        description: "Induction charging dock for effortless power.",
        price: "$89",
        image: "/templates/evasion/accessory-charger.png"
      },
      {
        title: "Protective Silicone Sleeve",
        description: "Textured grip sleeve for enhanced durability.",
        price: "$45",
        image: "/templates/evasion/accessory-sleeve.png"
      },
      {
        title: "Carbon Fiber Bike Mount",
        description: "Ultra-light mounting system for cycling.",
        price: "$129",
        image: "/templates/evasion/accessory-bike-mount.png"
      },
      {
        title: "Premium Carry Strap",
        description: "Adjustable strap with quick-release clips.",
        price: "$39",
        image: "/templates/evasion/accessory-strap.png"
      },
      {
        title: "Carabiner Clip System",
        description: "Secure attachment for hands-free carrying.",
        price: "$29",
        image: "/templates/evasion/accessory-carabiner.png"
      },
      {
        title: "Bluetooth Speaker Base",
        description: "High-fidelity audio dock with grip stabilizers.",
        price: "$149",
        image: "/templates/evasion/accessory-speaker-base.png"
      }
    ]
  },
  editorial: {
    specs: [
      { label: "Weight", value: "400g" },
      { label: "Capacity", value: "0.5L - 2L" },
      { label: "Setup", value: "2 min" },
      { label: "Packed size", value: "30 x 15 cm" }
    ],
    videoUrl:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bcdafadc-cb7e-4cb7-9cbf-edcbaf2360a5_1-cNBCz5fomcLRmm1cTXSBOKCq10VP91.mp4"
  },
  testimonial: {
    quote:
      "EVASION accessories combine aerospace-grade materials with cutting-edge technology — designed for explorers who refuse to compromise on quality or performance in the wild.",
    image: {
      src: "/templates/evasion/3d4046a0-b072-4b07-941f-9141ee3ed4a7.png",
      alt: "Mountain peaks at sunrise"
    }
  },
  reservation: {
    eyebrow: "Reserve",
    title: "Reserve your next EVASION setup.",
    description:
      "Book a private product walkthrough and get matched with the right gear, accessories, and expedition-ready bundle.",
    buttonLabel: "Reserve a session",
    buttonHref: "mailto:reserve@evasion.example"
  },
  footer: {
    description:
      "Premium smart bottles engineered for adventure. GPS tracking, LED flashlight, and self-heating technology.",
    columns: [
      {
        title: "Explore",
        links: [
          { label: "Products", href: "#products" },
          { label: "Technology", href: "#technology" },
          { label: "Gallery", href: "#gallery" },
          { label: "Accessories", href: "#accessories" }
        ]
      },
      {
        title: "About",
        links: [
          { label: "Our Story", href: "#about" },
          { label: "Team", href: "#reserve" },
          { label: "Careers", href: "#reserve" },
          { label: "Contact", href: "#reserve" }
        ]
      },
      {
        title: "Service",
        links: [
          { label: "FAQ", href: "#reserve" },
          { label: "Shipping", href: "#reserve" },
          { label: "Returns", href: "#reserve" },
          { label: "Warranty", href: "#reserve" }
        ]
      }
    ],
    legalText: "2026 EVASION. All rights reserved.",
    socials: [
      { label: "Instagram", href: "#" },
      { label: "Twitter", href: "#" },
      { label: "YouTube", href: "#" }
    ]
  }
};
