"use client";

import { create } from "zustand";
import type { ContentLanguage, GenerationBriefData, QualityMode } from "@/lib/builder/generation-config";
import type { StudioGenerationSpec } from "@/lib/website-studio/schema";

export type GenerationStatus = "idle" | "generating" | "done" | "error";
export type ProgressStatus = "running" | "completed";

export type GenerationBrief = {
  siteId: string;
  businessId: string;
  businessName: string;
  industry: string;
  themeStyle?: string;
  contentLanguage: ContentLanguage;
  qualityMode: QualityMode;
  generationBrief: GenerationBriefData;
  tone?: string;
  pagesMode?: string;
  templateId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string | null;
  description?: string;
  rawPrompt?: string;
  enhancedPrompt?: string;
  selectedTemplate?: string;
  contact?: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  openingHours?: string | null;
  socials?: {
    instagram?: string | null;
    facebook?: string | null;
    tiktok?: string | null;
    linkedin?: string | null;
    website?: string | null;
  };
  features?: {
    includeServices?: boolean;
    includeTestimonials?: boolean;
    includePricing?: boolean;
    includeFaq?: boolean;
    includeContact?: boolean;
    includeReservation?: boolean;
    includeGallery?: boolean;
  };
  hasOwnPhotos?: boolean;
  chatbotEmbedSnippet?: string | null;
  studioSpec?: StudioGenerationSpec;
  goal?: string;
  pages?: string[];
};

type GenerationState = {
  status: GenerationStatus;
  progressStepIndex: number;
  progressStatus: ProgressStatus;
  error: string | null;
  canceled: boolean;
  brief: GenerationBrief | null;
  setBrief: (brief: GenerationBrief) => void;
  setStatus: (status: GenerationStatus) => void;
  setError: (error: string | null) => void;
  setProgressStep: (index: number) => void;
  setProgressStatus: (status: ProgressStatus) => void;
  setCanceled: (value: boolean) => void;
  resetProgress: () => void;
};

export const useGenerationStore = create<GenerationState>((set) => ({
  status: "idle",
  progressStepIndex: 0,
  progressStatus: "running",
  error: null,
  canceled: false,
  brief: null,
  setBrief: (brief) => set({ brief }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setProgressStep: (index) => set({ progressStepIndex: index }),
  setProgressStatus: (status) => set({ progressStatus: status }),
  setCanceled: (value) => set({ canceled: value }),
  resetProgress: () =>
    set({ progressStepIndex: 0, progressStatus: "running", error: null, canceled: false })
}));
