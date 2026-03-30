import { z } from "zod";

export const INDUSTRY_OPTIONS = [
  "restaurant",
  "cafe",
  "gym",
  "hotel",
  "salon",
  "barber",
  "real_estate",
  "clinic",
  "shop",
  "car_dealer",
  "other"
] as const;

export const IndustrySchema = z.enum(INDUSTRY_OPTIONS);

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name is required").optional(),
  email: z.string().email(),
  password: z.string().min(6),
  businessName: z.string().min(2, "Business name is required"),
  industry: IndustrySchema.optional()
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
