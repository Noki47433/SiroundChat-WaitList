import type { SiteSection } from "@/lib/website-builder/types";

export type TemplateMeta = {
  id: string;
  name: string;
  description: string;
  industryTags: string[];
  thumbnailPath: string;
};

type SectionPreset = {
  type: SiteSection["type"];
  variant: string;
  enabled: boolean;
};

export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: "auto-modern",
    name: "Auto Modern",
    description: "Flexible layout for modern service brands.",
    industryTags: ["Service", "Agency"],
    thumbnailPath:
      "https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=1200"
  },
  {
    id: "restaurant-editorial",
    name: "Restaurant Editorial",
    description: "Editorial look for dining and hospitality.",
    industryTags: ["Restaurant", "Hospitality"],
    thumbnailPath:
      "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=1200"
  },
  {
    id: "clinic-clean",
    name: "Clinic Clean",
    description: "Calm, trusted layout for clinics and practices.",
    industryTags: ["Clinic", "Service"],
    thumbnailPath:
      "https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=1200"
  },
  {
    id: "beauty-lux",
    name: "Beauty Lux",
    description: "Premium look for beauty and wellness.",
    industryTags: ["Beauty", "Service"],
    thumbnailPath:
      "https://images.pexels.com/photos/3738349/pexels-photo-3738349.jpeg?auto=compress&cs=tinysrgb&w=1200"
  },
  {
    id: "corporate-sleek",
    name: "Corporate Sleek",
    description: "Sharp layout for consulting teams.",
    industryTags: ["Corporate", "Consulting", "Agency"],
    thumbnailPath:
      "https://images.pexels.com/photos/3183197/pexels-photo-3183197.jpeg?auto=compress&cs=tinysrgb&w=1200"
  },
  {
    id: "portfolio-minimal",
    name: "Portfolio Minimal",
    description: "Minimal gallery-forward layout for creators.",
    industryTags: ["Portfolio", "Creative"],
    thumbnailPath:
      "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&w=1200"
  },
  {
    id: "ecommerce-simple",
    name: "Ecommerce Simple",
    description: "Product-focused layout for small shops.",
    industryTags: ["Ecommerce", "Retail"],
    thumbnailPath:
      "https://images.pexels.com/photos/5632402/pexels-photo-5632402.jpeg?auto=compress&cs=tinysrgb&w=1200"
  },
  {
    id: "hospitality-resort",
    name: "Hospitality Resort",
    description: "Immersive layout for stays and resorts.",
    industryTags: ["Hospitality", "Travel"],
    thumbnailPath:
      "https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg?auto=compress&cs=tinysrgb&w=1200"
  }
];

export const TEMPLATE_DEFAULT_SECTIONS: Record<string, SectionPreset[]> = {
  "auto-modern": [
    { type: "hero", variant: "A", enabled: true },
    { type: "services", variant: "B", enabled: true },
    { type: "about", variant: "A", enabled: true },
    { type: "testimonials", variant: "A", enabled: true },
    { type: "pricing", variant: "A", enabled: false },
    { type: "cta", variant: "A", enabled: true },
    { type: "faq", variant: "A", enabled: false },
    { type: "contact", variant: "A", enabled: true },
    { type: "gallery", variant: "A", enabled: false },
    { type: "reservation", variant: "A", enabled: false },
    { type: "footer", variant: "A", enabled: true }
  ],
  "restaurant-editorial": [
    { type: "hero", variant: "B", enabled: true },
    { type: "about", variant: "B", enabled: true },
    { type: "services", variant: "A", enabled: true },
    { type: "gallery", variant: "A", enabled: true },
    { type: "testimonials", variant: "B", enabled: true },
    { type: "reservation", variant: "A", enabled: true },
    { type: "cta", variant: "B", enabled: true },
    { type: "faq", variant: "A", enabled: false },
    { type: "pricing", variant: "B", enabled: false },
    { type: "contact", variant: "B", enabled: true },
    { type: "footer", variant: "B", enabled: true }
  ],
  "clinic-clean": [
    { type: "hero", variant: "C", enabled: true },
    { type: "services", variant: "C", enabled: true },
    { type: "about", variant: "A", enabled: true },
    { type: "testimonials", variant: "A", enabled: true },
    { type: "faq", variant: "B", enabled: true },
    { type: "cta", variant: "A", enabled: true },
    { type: "contact", variant: "A", enabled: true },
    { type: "gallery", variant: "A", enabled: false },
    { type: "pricing", variant: "A", enabled: false },
    { type: "reservation", variant: "B", enabled: false },
    { type: "footer", variant: "A", enabled: true }
  ],
  "beauty-lux": [
    { type: "hero", variant: "A", enabled: true },
    { type: "services", variant: "B", enabled: true },
    { type: "gallery", variant: "B", enabled: true },
    { type: "testimonials", variant: "B", enabled: true },
    { type: "pricing", variant: "B", enabled: true },
    { type: "about", variant: "B", enabled: true },
    { type: "cta", variant: "B", enabled: true },
    { type: "faq", variant: "A", enabled: false },
    { type: "contact", variant: "A", enabled: true },
    { type: "reservation", variant: "A", enabled: false },
    { type: "footer", variant: "B", enabled: true }
  ],
  "corporate-sleek": [
    { type: "hero", variant: "C", enabled: true },
    { type: "services", variant: "C", enabled: true },
    { type: "about", variant: "A", enabled: true },
    { type: "testimonials", variant: "A", enabled: true },
    { type: "pricing", variant: "A", enabled: true },
    { type: "cta", variant: "A", enabled: true },
    { type: "faq", variant: "A", enabled: false },
    { type: "contact", variant: "B", enabled: true },
    { type: "gallery", variant: "A", enabled: false },
    { type: "reservation", variant: "A", enabled: false },
    { type: "footer", variant: "A", enabled: true }
  ],
  "portfolio-minimal": [
    { type: "hero", variant: "B", enabled: true },
    { type: "gallery", variant: "B", enabled: true },
    { type: "about", variant: "B", enabled: true },
    { type: "services", variant: "A", enabled: false },
    { type: "testimonials", variant: "A", enabled: false },
    { type: "pricing", variant: "A", enabled: false },
    { type: "cta", variant: "B", enabled: true },
    { type: "faq", variant: "A", enabled: false },
    { type: "contact", variant: "B", enabled: true },
    { type: "reservation", variant: "A", enabled: false },
    { type: "footer", variant: "B", enabled: true }
  ],
  "ecommerce-simple": [
    { type: "hero", variant: "A", enabled: true },
    { type: "services", variant: "B", enabled: true },
    { type: "gallery", variant: "A", enabled: true },
    { type: "pricing", variant: "A", enabled: true },
    { type: "testimonials", variant: "A", enabled: true },
    { type: "cta", variant: "A", enabled: true },
    { type: "about", variant: "A", enabled: false },
    { type: "faq", variant: "B", enabled: true },
    { type: "contact", variant: "A", enabled: true },
    { type: "reservation", variant: "A", enabled: false },
    { type: "footer", variant: "A", enabled: true }
  ],
  "hospitality-resort": [
    { type: "hero", variant: "B", enabled: true },
    { type: "gallery", variant: "A", enabled: true },
    { type: "about", variant: "B", enabled: true },
    { type: "services", variant: "A", enabled: true },
    { type: "testimonials", variant: "B", enabled: true },
    { type: "reservation", variant: "B", enabled: true },
    { type: "cta", variant: "B", enabled: true },
    { type: "faq", variant: "A", enabled: false },
    { type: "pricing", variant: "B", enabled: false },
    { type: "contact", variant: "A", enabled: true },
    { type: "footer", variant: "B", enabled: true }
  ]
};

const BASE_ALLOWED_VARIANTS: Record<string, string[]> = {
  hero: ["A", "B", "C"],
  services: ["A", "B", "C"],
  about: ["A", "B"],
  gallery: ["A", "B"],
  testimonials: ["A", "B"],
  pricing: ["A", "B"],
  cta: ["A", "B"],
  faq: ["A", "B"],
  contact: ["A", "B"],
  reservation: ["A", "B"],
  footer: ["A", "B"],
  newsletter: ["A"],
  "blog-index": ["A"],
  "blog-post": ["A"],
  "store-listing": ["A"],
  "store-product": ["A"],
  "store-cart": ["A"],
  custom: ["A"],
  "app-embed": ["A"]
};

export const TEMPLATE_ALLOWED_VARIANTS: Record<string, Record<string, string[]>> = {
  "auto-modern": BASE_ALLOWED_VARIANTS,
  "restaurant-editorial": BASE_ALLOWED_VARIANTS,
  "clinic-clean": BASE_ALLOWED_VARIANTS,
  "beauty-lux": BASE_ALLOWED_VARIANTS,
  "corporate-sleek": BASE_ALLOWED_VARIANTS,
  "portfolio-minimal": BASE_ALLOWED_VARIANTS,
  "ecommerce-simple": BASE_ALLOWED_VARIANTS,
  "hospitality-resort": BASE_ALLOWED_VARIANTS
};
