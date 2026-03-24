import { z } from "zod";
import { SPACING_PROFILE_IDS, TOKEN_SET_IDS } from "@/lib/builder/design/tokens";
import { SkeletonSectionSchema, StrictSectionSchema } from "@/lib/builder/generation/schemas/sections";
import { TEMPLATE_IDS } from "@/lib/builder/generation/templates/registry";

export const ToneProfileSchema = z.enum([
  "professional",
  "friendly",
  "premium",
  "bold",
  "calm",
  "playful"
]);

export const TokenSetIdSchema = z.enum(TOKEN_SET_IDS);
export const SpacingProfileSchema = z.enum(SPACING_PROFILE_IDS);
export const AlignmentProfileSchema = z.enum(["left", "center"]);
export const TemplateIdSchema = z.enum(TEMPLATE_IDS);

export const StrictPageSchema = z
  .object({
    pageId: z.string().trim().min(1).max(80),
    slug: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(80),
    sections: z.array(StrictSectionSchema).min(1).max(10)
  })
  .strict();

export const SkeletonPageSchema = z
  .object({
    pageId: z.string().trim().min(1).max(80),
    slug: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(80),
    sections: z.array(SkeletonSectionSchema).min(1).max(10)
  })
  .strict();

export const GenerationSiteDocumentSchema = z
  .object({
    templateId: TemplateIdSchema,
    toneProfile: ToneProfileSchema,
    tokenSetId: TokenSetIdSchema,
    spacingProfile: SpacingProfileSchema,
    alignmentProfile: AlignmentProfileSchema,
    pages: z.array(StrictPageSchema).min(1).max(5)
  })
  .strict();

export const SkeletonSiteDocumentSchema = z
  .object({
    templateId: TemplateIdSchema,
    toneProfile: ToneProfileSchema,
    tokenSetId: TokenSetIdSchema,
    spacingProfile: SpacingProfileSchema,
    alignmentProfile: AlignmentProfileSchema,
    pages: z.array(SkeletonPageSchema).min(1).max(5)
  })
  .strict();

export type GenerationSiteDocument = z.infer<typeof GenerationSiteDocumentSchema>;
export type GenerationPage = z.infer<typeof StrictPageSchema>;
export type SkeletonSiteDocument = z.infer<typeof SkeletonSiteDocumentSchema>;
