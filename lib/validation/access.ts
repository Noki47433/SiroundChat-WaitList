import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => value?.trim() || "");

export const RequestAccessSchema = z
  .object({
    businessName: z.string().trim().min(2, "Business name is required").max(120),
    ownerName: optionalTrimmed(120),
    email: z.string().trim().email("A valid business email is required").max(320),
    phone: optionalTrimmed(40),
    websiteUrl: optionalTrimmed(240),
    instagramUrl: optionalTrimmed(240),
    businessType: optionalTrimmed(80),
    note: optionalTrimmed(2000)
  })
  .refine((value) => Boolean(value.websiteUrl || value.instagramUrl), {
    path: ["websiteUrl"],
    message: "Add a website or Instagram profile."
  });

export const ManualInviteCodeSchema = z.object({
  assignedEmail: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(320)
    .optional()
    .or(z.literal(""))
    .transform((value) => value?.trim() || ""),
  assignedBusinessName: optionalTrimmed(120),
  maxUses: z.coerce.number().int().min(1).max(100).default(1),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => value?.trim() || "")
});
