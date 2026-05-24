import { z } from "zod";

export const TemplateKeySchema = z.enum([
  "restaurant_v1",
  "service_v1",
  "generic_v1",
  "evasion",
  "essence",
  "hously",
  "food-truck"
]);
export type TemplateKey = z.infer<typeof TemplateKeySchema>;

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

const HeroSchema = z.object({
  headline: requiredText(96),
  subheadline: requiredText(240),
  ctaLabel: requiredText(40),
  ctaHref: requiredText(2048)
});

const AboutSchema = z.object({
  title: requiredText(72),
  body: requiredText(700)
});

const ServiceItemSchema = z.object({
  title: requiredText(72),
  body: requiredText(280)
});

const ServicesSchema = z.object({
  title: requiredText(72),
  items: z.array(ServiceItemSchema).min(1).max(6)
});

const GallerySchema = z.object({
  title: requiredText(72),
  images: z
    .array(
      z.object({
        url: requiredText(2048),
        alt: requiredText(120)
      })
    )
    .min(1)
    .max(8)
});

const MenuItemSchema = z.object({
  name: requiredText(72),
  description: requiredText(200),
  price: optionalText(24)
});

const MenuSchema = z.object({
  title: requiredText(72),
  items: z.array(MenuItemSchema).min(1).max(12)
});

const ReservationSchema = z.object({
  enabled: z.boolean(),
  title: requiredText(72),
  description: requiredText(280)
});

const ContactSchema = z.object({
  title: requiredText(72),
  body: requiredText(360),
  email: optionalText(120),
  phone: optionalText(40),
  address: optionalText(160)
});

const FooterSchema = z.object({
  text: requiredText(140)
});

export const SiteContentSchema = z.object({
  hero: HeroSchema,
  about: AboutSchema,
  services: ServicesSchema,
  gallery: GallerySchema.optional(),
  menu: MenuSchema.optional(),
  reservation: ReservationSchema.optional(),
  contact: ContactSchema,
  footer: FooterSchema
});

export type SiteContent = z.infer<typeof SiteContentSchema>;

export const SectionKeys = ["hero", "about", "services", "contact"] as const;
export type SectionKey = (typeof SectionKeys)[number];
