export type TonePreset = "professional" | "friendly" | "luxury" | "short_direct" | "energetic";
export type ConversationStatus = "open" | "closed";
export type ConversationTag = "lead" | "support";
export type DocumentStatus = "processing" | "ready";
export type PlanId = "starter" | "pro";
export type BillingStatus = "active" | "pending";

export interface OrgSummary {
  id: string;
  name: string;
  plan: PlanId;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface OverviewStat {
  label: string;
  value: string;
  change?: string;
}

export interface ConversationSummary {
  id: string;
  visitorId: string;
  startedAt: string;
  lastMessageAt: string;
  status: ConversationStatus;
  tags: ConversationTag[];
}

export interface ConversationMessage {
  id: string;
  sender: "visitor" | "bot" | "agent" | "owner";
  text: string;
  timestamp: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
}

export interface DocumentItem {
  id: string;
  filename: string;
  type: string;
  size: string;
  uploadedAt: string;
  status: DocumentStatus;
}

export interface AnalyticsSummary {
  uniqueVisitors: number;
  conversations: number;
  opens: number;
  leads: number;
  topQuestions: string[];
  series: { label: string; value: number }[];
  seriesByMetric?: {
    conversations: { label: string; value: number }[];
    opens: { label: string; value: number }[];
    leads: { label: string; value: number }[];
  };
  eventCounts?: Record<string, number>;
}

export interface EmailReportSettings {
  enabled: boolean;
  recipient: string;
  preview: {
    subject: string;
    summary: string;
    highlights: string[];
  };
}

export interface BotSettings {
  businessName: string;
  greeting: string;
  tone: TonePreset;
  logoUrl?: string | null;
}

export interface ToneExample {
  question: string;
  answer: string;
}

export type ToneExamples = Record<TonePreset, ToneExample[]>;

export interface BillingPlan {
  id: PlanId;
  name: string;
  price: string;
  features: string[];
}

export interface BillingState {
  currentPlan: PlanId;
  status: BillingStatus;
  renewalDate: string;
}

export interface AccountProfile {
  name: string;
  email: string;
  timezone: string;
}
