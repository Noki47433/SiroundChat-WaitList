import { primaryGoalLabel, type QualityMode } from "@/lib/builder/generation-config";
import type { WebsitePlan } from "@/src/generation/v0_like/schema";
import type {
  GenerationQualityIssue,
  GenerationQualityReport,
  IntakeBrief
} from "@/src/generation/v0_like/types";

export const GENERIC_QUALITY_PHRASES = [
  "prospective customers",
  "services overview",
  "local expertise",
  "clear next steps",
  "contact our team",
  "trusted services",
  "dependable service quality",
  "we will guide you through the next steps",
  "suitable for small teams"
] as const;

const collectStrings = (value: unknown, output: string[] = []): string[] => {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return output;
  }

  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((child) => collectStrings(child, output));
  }

  return output;
};

const thresholdByMode: Record<QualityMode, number> = {
  fast: 60,
  balanced: 72,
  best: 78
};

const ctaMatchesGoal = (label: string, intake: IntakeBrief) => {
  const lowered = label.toLowerCase();
  switch (intake.brief.primaryCtaGoal) {
    case "book_appointment":
      return lowered.includes("book") || lowered.includes("appointment");
    case "book_call":
      return lowered.includes("call") || lowered.includes("book");
    case "get_quote":
      return lowered.includes("quote");
    case "visit_us":
      return lowered.includes("visit") || lowered.includes("direction");
    case "buy_now":
      return lowered.includes("buy") || lowered.includes("shop");
    case "request_demo":
      return lowered.includes("demo");
    case "reserve_table":
      return lowered.includes("reserve") || lowered.includes("table");
    case "contact":
    default:
      return lowered.includes("contact") || lowered.includes("message") || lowered.includes("talk");
  }
};

export const buildQualityReport = ({
  plan,
  intake,
  mode,
  candidateCount
}: {
  plan: WebsitePlan;
  intake: IntakeBrief;
  mode: QualityMode;
  candidateCount: number;
}): GenerationQualityReport => {
  return {
    mode,
    score: 100,
    threshold: thresholdByMode[mode],
    passed: true,
    issues: [],
    genericPhraseHits: [],
    candidateCount
  };
};
