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
  const issues: GenerationQualityIssue[] = [];
  let score = 100;
  const strings = collectStrings(plan).map((value) => value.toLowerCase());
  const genericPhraseHits = GENERIC_QUALITY_PHRASES.filter((phrase) =>
    strings.some((value) => value.includes(phrase))
  );

  if (genericPhraseHits.length > 0) {
    score -= Math.min(36, genericPhraseHits.length * 9);
    issues.push({
      code: "generic_copy",
      severity: "warning",
      message: `Generator fell back to generic copy: ${genericPhraseHits.join(", ")}.`,
      suggestion: "Add more concrete services, audience context, and proof points to the brief."
    });
  }

  const hero = plan.sections.find((section) => section.type === "hero");
  if (hero?.type === "hero") {
    const heroText = `${hero.copy.headline} ${hero.copy.subheadline}`.toLowerCase();
    const matchedServices = intake.brief.topServices.filter((service) =>
      heroText.includes(service.toLowerCase())
    );
    if (matchedServices.length === 0 && intake.brief.topServices.length > 0) {
      score -= 10;
      issues.push({
        code: "service_specificity",
        severity: "warning",
        message: "Hero copy does not reference any of the top services from the brief.",
        suggestion: "Lead the hero with one concrete service or customer outcome."
      });
    }
  } else {
    score -= 15;
    issues.push({
      code: "missing_hero",
      severity: "error",
      message: "Generated plan is missing a valid hero section.",
      suggestion: "Regenerate after tightening the business brief."
    });
  }

  const servicesCoverage = intake.brief.topServices.filter((service) =>
    strings.some((value) => value.includes(service.toLowerCase()))
  ).length;
  if (intake.brief.topServices.length > 0 && servicesCoverage < Math.min(2, intake.brief.topServices.length)) {
    score -= 12;
    issues.push({
      code: "brief_coverage",
      severity: "warning",
      message: "Generated copy does not reflect enough of the brief's top services.",
      suggestion: "Add more specific service names and desired outcomes in the brief."
    });
  }

  if (intake.brief.proofPoints.length > 0) {
    const proofCoverage = intake.brief.proofPoints.filter((proof) =>
      strings.some((value) => value.includes(proof.toLowerCase()))
    ).length;
    if (proofCoverage === 0) {
      score -= 8;
      issues.push({
        code: "proof_coverage",
        severity: "warning",
        message: "None of the provided proof points showed up in the generated copy.",
        suggestion: "Add stronger evidence, credentials, or customer trust markers in the brief."
      });
    }
  }

  const primaryLabel = plan.cta.primary.label;
  if (!ctaMatchesGoal(primaryLabel, intake)) {
    score -= 14;
    issues.push({
      code: "cta_alignment",
      severity: "error",
      message: `Primary CTA '${primaryLabel}' does not align with the requested goal '${primaryGoalLabel(
        intake.brief.primaryCtaGoal
      )}'.`,
      suggestion: "Choose a clearer CTA goal or regenerate with the current brief."
    });
  }

  if (
    ["barbershop", "clinic", "local_business"].includes(intake.vertical) &&
    plan.sections.length < 7
  ) {
    score -= 10;
    issues.push({
      code: "thin_structure",
      severity: "warning",
      message: "Local-business output is too thin and is missing persuasive structure.",
      suggestion: "Use balanced or best mode and keep FAQ/testimonials enabled."
    });
  }

  if (plan.meta.locale !== (intake.language === "sq" ? "sq-AL" : "en-GB")) {
    score -= 10;
    issues.push({
      code: "locale_mismatch",
      severity: "error",
      message: "Plan locale does not match the selected content language.",
      suggestion: "Regenerate after re-selecting the target language."
    });
  }

  const threshold = thresholdByMode[mode];
  const passed = score >= threshold && !issues.some((issue) => issue.severity === "error");

  return {
    mode,
    score,
    threshold,
    passed,
    issues,
    genericPhraseHits: [...genericPhraseHits],
    candidateCount
  };
};
