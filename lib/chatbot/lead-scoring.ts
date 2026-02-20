export type LeadStatus = "hot" | "warm" | "cold";

export type LeadScoreInput = {
  budgetRange?: string | null;
  urgency?: string | null;
  decisionMaker?: boolean | null;
  hasContactInfo?: boolean;
};

export type LeadScoreResult = {
  score: number;
  status: LeadStatus;
};

const HIGH_BUDGET_KEYWORDS = ["high", "premium", "enterprise", "luxury", "1000", "2000", "3000"];
const URGENT_KEYWORDS = ["today", "asap", "urgent", "this week", "this-week", "tomorrow"];

const normalize = (value: string | null | undefined) => (value ?? "").toLowerCase().trim();

const scoreBudget = (budgetRange?: string | null) => {
  const normalized = normalize(budgetRange);
  if (!normalized) return 0;
  if (HIGH_BUDGET_KEYWORDS.some((keyword) => normalized.includes(keyword))) return 30;
  return 0;
};

const scoreUrgency = (urgency?: string | null) => {
  const normalized = normalize(urgency);
  if (!normalized) return 0;
  if (URGENT_KEYWORDS.some((keyword) => normalized.includes(keyword))) return 25;
  return 0;
};

const scoreDecisionMaker = (decisionMaker?: boolean | null) => (decisionMaker ? 20 : 0);

const scoreContactInfo = (hasContactInfo?: boolean) => (hasContactInfo ? 15 : 0);

export function getLeadStatus(score: number): LeadStatus {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function scoreLeadQualification(input: LeadScoreInput): LeadScoreResult {
  const score =
    scoreBudget(input.budgetRange) +
    scoreUrgency(input.urgency) +
    scoreDecisionMaker(input.decisionMaker) +
    scoreContactInfo(input.hasContactInfo);

  return {
    score,
    status: getLeadStatus(score)
  };
}
