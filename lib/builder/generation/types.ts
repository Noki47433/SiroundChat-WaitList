import type { TokenSetId, SpacingProfile } from "@/lib/builder/design/tokens";
import type { SectionType } from "@/lib/builder/generation/schemas/sections";

export type GenerationIntake = {
  businessName: string;
  businessType: string;
  subtype?: string | null;
  location?: string | null;
  services: string[];
  targetCustomer?: string | null;
  toneProfile: "professional" | "friendly" | "premium" | "bold" | "calm" | "playful";
  ctaIntent: "contact" | "call" | "quote" | "reserve" | "buy" | "demo";
  proofAssets: string[];
  photosAvailable: boolean;
  description: string;
  uploadedImages?: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }>;
};

export type GenerationPlan = {
  templateId: string;
  sectionOrder: SectionType[];
  variants: Partial<Record<SectionType, string>>;
  tokenSetId: TokenSetId;
  spacingProfile: SpacingProfile;
  alignmentProfile: "left" | "center";
};
