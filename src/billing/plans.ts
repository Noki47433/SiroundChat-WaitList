export type PlanId =
  | "website_only"
  | "chatbot_only"
  | "website_chatbot"
  | "social_inbox"
  | "omni_channel";

export type EntitlementKey =
  | "website_builder"
  | "publish_website"
  | "custom_domain"
  | "forms_lead_capture"
  | "basic_analytics"
  | "advanced_analytics"
  | "templates_premium"
  | "multi_page_site"
  | "multi_site"
  | "team_members"
  | "chatbot"
  | "chatbot_embed"
  | "chatbot_website_injection"
  | "chatbot_knowledge_base"
  | "chatbot_actions"
  | "chatbot_lead_capture"
  | "reservations"
  | "reservation_management"
  | "whatsapp"
  | "instagram"
  | "unified_inbox"
  | "human_takeover"
  | "channel_settings"
  | "social_automation"
  | "social_replies"
  | "webhooks"
  | "integrations"
  | "priority_support"
  | "sla"
  | "audit_logs"
  | "export_data";

export type Entitlements = Record<EntitlementKey, boolean | number>;

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceMonthlyEUR: number | null;
  badge?: "RECOMMENDED" | "ALL-IN";
  subtitle: string;
  features: string[];
  entitlements: Entitlements;
};

const baseEntitlements = (): Entitlements => ({
  website_builder: false,
  publish_website: false,
  custom_domain: false,
  forms_lead_capture: false,
  basic_analytics: false,
  advanced_analytics: false,
  templates_premium: false,
  multi_page_site: false,
  multi_site: 0,
  team_members: 0,
  chatbot: false,
  chatbot_embed: false,
  chatbot_website_injection: false,
  chatbot_knowledge_base: false,
  chatbot_actions: false,
  chatbot_lead_capture: false,
  reservations: false,
  reservation_management: false,
  whatsapp: false,
  instagram: false,
  unified_inbox: false,
  human_takeover: false,
  channel_settings: false,
  social_automation: false,
  social_replies: false,
  webhooks: false,
  integrations: false,
  priority_support: false,
  sla: false,
  audit_logs: false,
  export_data: false
});

const WEBSITE_ONLY_ENTITLEMENTS: Entitlements = {
  ...baseEntitlements(),
  website_builder: true,
  publish_website: true,
  custom_domain: true,
  forms_lead_capture: true,
  basic_analytics: true,
  templates_premium: true,
  multi_page_site: true,
  multi_site: 1,
  team_members: 1,
  reservations: true,
  reservation_management: true
};

const CHATBOT_ONLY_ENTITLEMENTS: Entitlements = {
  ...baseEntitlements(),
  basic_analytics: true,
  team_members: 1,
  chatbot: true,
  chatbot_embed: true,
  chatbot_knowledge_base: true,
  chatbot_actions: true,
  chatbot_lead_capture: true,
  reservations: true,
  reservation_management: true
};

const WEBSITE_CHATBOT_ENTITLEMENTS: Entitlements = {
  ...baseEntitlements(),
  website_builder: true,
  publish_website: true,
  custom_domain: true,
  forms_lead_capture: true,
  basic_analytics: true,
  advanced_analytics: true,
  templates_premium: true,
  multi_page_site: true,
  multi_site: 1,
  team_members: 3,
  chatbot: true,
  chatbot_embed: true,
  chatbot_website_injection: true,
  chatbot_knowledge_base: true,
  chatbot_actions: true,
  chatbot_lead_capture: true,
  reservations: true,
  reservation_management: true,
  webhooks: true,
  export_data: true
};

const SOCIAL_INBOX_ENTITLEMENTS: Entitlements = {
  ...baseEntitlements(),
  basic_analytics: true,
  team_members: 3,
  whatsapp: true,
  instagram: true,
  unified_inbox: true,
  human_takeover: true,
  channel_settings: true,
  social_automation: true,
  social_replies: true,
  integrations: true,
  export_data: true
};

const OMNI_CHANNEL_ENTITLEMENTS: Entitlements = {
  ...baseEntitlements(),
  website_builder: true,
  publish_website: true,
  custom_domain: true,
  forms_lead_capture: true,
  basic_analytics: true,
  advanced_analytics: true,
  templates_premium: true,
  multi_page_site: true,
  multi_site: 3,
  team_members: 5,
  chatbot: true,
  chatbot_embed: true,
  chatbot_website_injection: true,
  chatbot_knowledge_base: true,
  chatbot_actions: true,
  chatbot_lead_capture: true,
  reservations: true,
  reservation_management: true,
  whatsapp: true,
  instagram: true,
  unified_inbox: true,
  human_takeover: true,
  channel_settings: true,
  social_automation: true,
  social_replies: true,
  webhooks: true,
  integrations: true,
  priority_support: true,
  sla: false,
  audit_logs: false,
  export_data: true
};

export const PLANS: PlanDefinition[] = [
  {
    id: "website_only",
    name: "Website Only",
    priceMonthlyEUR: 19.99,
    subtitle: "Launch, publish, and run your restaurant website with polished basics already included.",
    features: [
      "Website builder and publishing",
      "Custom domain and contact capture",
      "Website reservation flow",
      "Basic website analytics",
      "Premium sections and templates"
    ],
    entitlements: WEBSITE_ONLY_ENTITLEMENTS
  },
  {
    id: "chatbot_only",
    name: "AI Chatbot Only",
    priceMonthlyEUR: 19.99,
    subtitle: "Answer questions, qualify leads, and automate customer conversations anywhere you already have traffic.",
    features: [
      "AI chatbot and external embed",
      "Knowledge base and FAQ grounding",
      "Lead capture inside chat",
      "Reservation automation support",
      "Chatbot actions and prompts"
    ],
    entitlements: CHATBOT_ONLY_ENTITLEMENTS
  },
  {
    id: "website_chatbot",
    name: "Website + AI",
    priceMonthlyEUR: 34.99,
    badge: "RECOMMENDED",
    subtitle: "Your full SiroundChat growth stack: website, chatbot, shared conversion flow, and deeper insight.",
    features: [
      "Everything in Website Only",
      "Everything in AI Chatbot Only",
      "Attach the chatbot directly to your Siround website",
      "Unified reservations and lead capture",
      "Advanced analytics and exports"
    ],
    entitlements: WEBSITE_CHATBOT_ENTITLEMENTS
  },
  {
    id: "social_inbox",
    name: "Social Inbox",
    priceMonthlyEUR: 29.99,
    subtitle: "Handle WhatsApp and Instagram conversations from one operational workspace.",
    features: [
      "WhatsApp and Instagram connectivity",
      "Unified inbox and agent replies",
      "Channel settings and human takeover",
      "Social reply automation",
      "Operational exports"
    ],
    entitlements: SOCIAL_INBOX_ENTITLEMENTS
  },
  {
    id: "omni_channel",
    name: "Full Omni-Channel",
    priceMonthlyEUR: 49.99,
    badge: "ALL-IN",
    subtitle: "Everything SiroundChat offers across website, chatbot, inbox, social, and operations.",
    features: [
      "Website, chatbot, and social inbox together",
      "Chatbot on your Siround website",
      "WhatsApp and Instagram operations",
      "Reservations, exports, and advanced analytics",
      "Priority support for revenue-critical workflows"
    ],
    entitlements: OMNI_CHANNEL_ENTITLEMENTS
  }
];

const PLAN_MAP = new Map<PlanId, PlanDefinition>(PLANS.map((plan) => [plan.id, plan]));

export const PLAN_ORDER: PlanId[] = PLANS.map((plan) => plan.id);

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && PLAN_MAP.has(value as PlanId);
}

export function getPlanDefinition(planId: PlanId): PlanDefinition {
  return PLAN_MAP.get(planId) ?? PLAN_MAP.get("website_only")!;
}

export function resolveEntitlements(planId: PlanId): Entitlements {
  return { ...getPlanDefinition(planId).entitlements };
}
