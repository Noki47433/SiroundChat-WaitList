export type BusinessRiskInput = {
  businessId: string;
  businessName: string;
  subscriptionStatus: string | null;
  revenueMrrEur: number;
  messagesLast7d: number;
  messagesPrev7d: number;
  leadsLast7d: number;
  leadsPrev7d: number;
  aiCostLast7d: number;
};

export type BusinessRiskResult = {
  businessId: string;
  businessName: string;
  score: number;
  atRisk: boolean;
  highPerformer: boolean;
  reasons: string[];
  highlights: string[];
};

const pctDrop = (current: number, previous: number) => {
  if (previous <= 0) return 0;
  return (previous - current) / previous;
};

const pctGrowth = (current: number, previous: number) => {
  if (previous <= 0) return 0;
  return (current - previous) / previous;
};

export function scoreBusinessRisk(input: BusinessRiskInput): BusinessRiskResult {
  let score = 0;
  const reasons: string[] = [];
  const highlights: string[] = [];

  if (input.subscriptionStatus === "past_due" || input.subscriptionStatus === "canceled") {
    score += 45;
    reasons.push(`Subscription status is ${input.subscriptionStatus}.`);
  }

  const messageDrop = pctDrop(input.messagesLast7d, input.messagesPrev7d);
  if (input.messagesPrev7d > 0 && messageDrop > 0.4) {
    score += 25;
    reasons.push(`Messages dropped ${(messageDrop * 100).toFixed(0)}% week-over-week.`);
  }

  const leadsDrop = pctDrop(input.leadsLast7d, input.leadsPrev7d);
  if (input.leadsPrev7d > 0 && leadsDrop > 0.4) {
    score += 20;
    reasons.push(`Leads dropped ${(leadsDrop * 100).toFixed(0)}% week-over-week.`);
  }

  if (input.revenueMrrEur > 0) {
    const costRatio = input.aiCostLast7d / input.revenueMrrEur;
    if (costRatio > 0.6) {
      score += 20;
      reasons.push(`AI cost/revenue ratio is ${(costRatio * 100).toFixed(0)}%.`);
    }
  }

  const messageGrowth = pctGrowth(input.messagesLast7d, input.messagesPrev7d);
  if (input.messagesPrev7d > 0 && messageGrowth > 0.5) {
    highlights.push(`Messages up ${(messageGrowth * 100).toFixed(0)}% week-over-week.`);
  }

  const leadsGrowth = pctGrowth(input.leadsLast7d, input.leadsPrev7d);
  if (input.leadsPrev7d > 0 && leadsGrowth > 0.3) {
    highlights.push(`Leads up ${(leadsGrowth * 100).toFixed(0)}% week-over-week.`);
  }

  return {
    businessId: input.businessId,
    businessName: input.businessName,
    score,
    atRisk: score >= 30,
    highPerformer: highlights.length >= 2,
    reasons,
    highlights
  };
}
