import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name is required").optional(),
  email: z.string().email(),
  password: z.string().min(6),
  businessName: z.string().min(2).optional(),
  industry: z
    .enum([
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
  ])
    .optional()
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
