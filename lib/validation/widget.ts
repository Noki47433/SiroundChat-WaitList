import { z } from "zod";

const TonePresetSchema = z.enum(["professional", "friendly", "luxury", "short_direct", "energetic"]);

export const WidgetConfigSchema = z.object({
  siteId: z.union([z.string().uuid(), z.string().min(3)]),
  businessName: z.string().min(1).max(120).optional(),
  theme: z
    .object({
      primary: z.string(),
      accent: z.string().optional(),
      secondary: z.string(),
      background: z.string(),
      text: z.string(),
      shape: z.enum(["rounded", "pill", "square"])
    })
    .optional(),
  greeting: z.string().min(1).max(160).optional(),
  tonePreset: TonePresetSchema.optional(),
  launcherPosition: z.enum(["left", "right"]).optional(),
  launcherVariant: z.enum(["icon", "iconWithLabel"]).optional(),
  language: z.enum(["auto", "en", "sq"]).optional(),
  showLogo: z.boolean().optional(),
  logoUrl: z.string().url().optional().or(z.literal(null)),
  iconId: z.string().optional().or(z.literal(null)),
  businessType: z.enum([ // Persist builder business type for preview parity
    "restaurant", // Restaurant business type
    "hotel", // Hotel business type
    "cafe", // Cafe business type
    "barber", // Barber business type
    "real_estate", // Real estate business type
    "clinic", // Clinic business type
    "gym", // Gym business type
    "taxi", // Taxi business type
    "ecommerce", // E-commerce business type
    "custom" // Custom business type
  ]).optional(), // Business type is optional for the widget
  faqs: z.array( // Persist FAQ list for embed conversation matching
    z.object({ // FAQ schema for each item
      id: z.string(), // FAQ item id
      question: z.string(), // FAQ question text
      answer: z.string() // FAQ answer text
    }) // Single FAQ record shape
  ).optional() // FAQ list is optional for the widget
});
