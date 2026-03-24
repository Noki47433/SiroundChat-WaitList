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
    id: "barbershop-editorial",
    name: "Barbershop Editorial",
    description: "High-identity layout for barber brands.",
    industryTags: ["Barbershop", "Grooming", "Local Service"],
    thumbnailPath:
      "https://images.pexels.com/photos/1319461/pexels-photo-1319461.jpeg?auto=compress&cs=tinysrgb&w=1200"
  },
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
    id: "dental-assurance",
    name: "Dental Assurance",
    description: "Trust-first layout for dental clinics.",
    industryTags: ["Dental", "Clinic", "Medical"],
    thumbnailPath:
      "https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=1200"
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
    id: "real-estate-signature",
    name: "Real Estate Signature",
    description: "Lead-focused layout for real estate agencies.",
    industryTags: ["Real Estate", "Property", "Agency"],
    thumbnailPath:
      "https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=1200"
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
  },
  {
    id: "legal-clarity",
    name: "Legal Clarity",
    description: "Structured, trust-first layout for legal services.",
    industryTags: ["Legal", "Professional"],
    thumbnailPath:
      "https://images.pexels.com/photos/5668473/pexels-photo-5668473.jpeg?auto=compress&cs=tinysrgb&w=1200"
  },
  {
    id: "home-services-trust",
    name: "Home Services Trust",
    description: "Conversion-focused layout for local home services.",
    industryTags: ["Home Services", "Local Service"],
    thumbnailPath:
      "https://images.pexels.com/photos/8293744/pexels-photo-8293744.jpeg?auto=compress&cs=tinysrgb&w=1200"
  }
];

export const TEMPLATE_DEFAULT_SECTIONS: Record<string, SectionPreset[]> = {
  "barbershop-editorial": [
    { type: "hero", variant: "A", enabled: true },
    { type: "services", variant: "B", enabled: true },
    { type: "gallery", variant: "B", enabled: true },
    { type: "about", variant: "B", enabled: true },
    { type: "cta", variant: "A", enabled: true },
    { type: "contact", variant: "B", enabled: true },
    { type: "footer", variant: "B", enabled: true }
  ],
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
  "dental-assurance": [
    { type: "hero", variant: "C", enabled: true },
    { type: "services", variant: "C", enabled: true },
    { type: "about", variant: "A", enabled: true },
    { type: "faq", variant: "B", enabled: true },
    { type: "cta", variant: "A", enabled: true },
    { type: "contact", variant: "A", enabled: true },
    { type: "footer", variant: "A", enabled: true }
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
  "real-estate-signature": [
    { type: "hero", variant: "A", enabled: true },
    { type: "pricing", variant: "A", enabled: true },
    { type: "services", variant: "C", enabled: true },
    { type: "about", variant: "B", enabled: true },
    { type: "cta", variant: "A", enabled: true },
    { type: "contact", variant: "B", enabled: true },
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
  ],
  "legal-clarity": [
    { type: "hero", variant: "A", enabled: true },
    { type: "about", variant: "A", enabled: true },
    { type: "services", variant: "A", enabled: true },
    { type: "faq", variant: "A", enabled: true },
    { type: "cta", variant: "A", enabled: true },
    { type: "contact", variant: "A", enabled: true },
    { type: "footer", variant: "A", enabled: true }
  ],
  "home-services-trust": [
    { type: "hero", variant: "A", enabled: true },
    { type: "services", variant: "A", enabled: true },
    { type: "pricing", variant: "A", enabled: true },
    { type: "testimonials", variant: "A", enabled: true },
    { type: "faq", variant: "A", enabled: true },
    { type: "cta", variant: "A", enabled: true },
    { type: "contact", variant: "A", enabled: true },
    { type: "footer", variant: "A", enabled: true }
  ]
};

const BASE_ALLOWED_VARIANTS: Record<string, string[]> = {
  hero: ["A", "B", "C", "D", "E", "F", "G", "H"],
  services: ["A", "B", "C", "D", "E", "F", "G"],
  about: ["A", "B", "C", "D", "E", "F"],
  gallery: ["A", "B", "C", "D", "E"],
  testimonials: ["A", "B", "C", "D", "E", "F"],
  pricing: ["A", "B", "C", "D", "E"],
  cta: ["A", "B", "C", "D", "E", "F"],
  faq: ["A", "B", "C"],
  contact: ["A", "B", "C", "D", "E", "F"],
  reservation: ["A", "B", "C"],
  footer: ["A", "B", "C"],
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
  "barbershop-editorial": BASE_ALLOWED_VARIANTS,
  "auto-modern": BASE_ALLOWED_VARIANTS,
  "restaurant-editorial": BASE_ALLOWED_VARIANTS,
  "dental-assurance": BASE_ALLOWED_VARIANTS,
  "clinic-clean": BASE_ALLOWED_VARIANTS,
  "beauty-lux": BASE_ALLOWED_VARIANTS,
  "real-estate-signature": BASE_ALLOWED_VARIANTS,
  "corporate-sleek": BASE_ALLOWED_VARIANTS,
  "portfolio-minimal": BASE_ALLOWED_VARIANTS,
  "ecommerce-simple": BASE_ALLOWED_VARIANTS,
  "hospitality-resort": BASE_ALLOWED_VARIANTS,
  "legal-clarity": BASE_ALLOWED_VARIANTS,
  "home-services-trust": BASE_ALLOWED_VARIANTS
};
