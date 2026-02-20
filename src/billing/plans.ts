export type PlanId = "website" | "bundle" | "chatbot";

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
  | "chatbot_knowledge_base"
  | "chatbot_actions"
  | "chatbot_lead_capture"
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
  badge?: "RECOMMENDED";
  subtitle: string;
  features: string[];
  entitlements: Entitlements;
};

const WEBSITE_ENTITLEMENTS: Entitlements = {
  website_builder: true,
  publish_website: true,
  custom_domain: true,
  forms_lead_capture: true,
  basic_analytics: true,
  advanced_analytics: false,
  templates_premium: true,
  multi_page_site: true,
  multi_site: 1,
  team_members: 1,
  chatbot: false,
  chatbot_embed: false,
  chatbot_knowledge_base: false,
  chatbot_actions: false,
  chatbot_lead_capture: false,
  webhooks: false,
  integrations: false,
  priority_support: false,
  sla: false,
  audit_logs: false,
  export_data: false
};

const BUNDLE_ENTITLEMENTS: Entitlements = {
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
  chatbot_knowledge_base: true,
  chatbot_actions: true,
  chatbot_lead_capture: true,
  webhooks: true,
  integrations: true,
  priority_support: true,
  sla: false,
  audit_logs: false,
  export_data: true
};

const CHATBOT_ENTITLEMENTS: Entitlements = {
  website_builder: false,
  publish_website: false,
  custom_domain: false,
  forms_lead_capture: false,
  basic_analytics: true,
  advanced_analytics: false,
  templates_premium: false,
  multi_page_site: false,
  multi_site: 0,
  team_members: 1,
  chatbot: true,
  chatbot_embed: true,
  chatbot_knowledge_base: true,
  chatbot_actions: true,
  chatbot_lead_capture: true,
  webhooks: false,
  integrations: false,
  priority_support: false,
  sla: false,
  audit_logs: false,
  export_data: false
};

export const PLANS: PlanDefinition[] = [
  {
    id: "website",
    name: "WEBSITE",
    priceMonthlyEUR: 19,
    subtitle: "Everything you need to launch your website.",
    features: [
      "Website builder + templates",
      "Custom domain support",
      "Multi-page site (sections + pages)",
      "Lead capture forms (contact + inquiries)",
      "Basic analytics (visits + leads)",
      "Publish & host on Siround",
      "1 workspace member",
      "Premium templates included"
    ],
    entitlements: WEBSITE_ENTITLEMENTS
  },
  {
    id: "bundle",
    name: "BUNDLE",
    priceMonthlyEUR: 29,
    badge: "RECOMMENDED",
    subtitle: "Website + chatbot for growth-focused teams.",
    features: [
      "Everything in Website",
      "AI chatbot widget + embed",
      "Knowledge base grounding (files/FAQ)",
      "Lead capture inside chatbot",
      "Chatbot actions (qualify, book, handoff)",
      "Advanced analytics (chat + conversion)",
      "Webhooks (Zapier-style workflows)",
      "3 workspace members",
      "Export leads & conversations (CSV)"
    ],
    entitlements: BUNDLE_ENTITLEMENTS
  },
  {
    id: "chatbot",
    name: "CHATBOT",
    priceMonthlyEUR: 19,
    subtitle: "Chatbot-only plan for customer conversations.",
    features: [
      "AI chatbot widget + embed",
      "Knowledge base grounding (files/FAQ)",
      "Lead capture inside chatbot",
      "Chatbot actions (qualify, book, handoff)",
      "Basic chatbot analytics",
      "Custom chatbot theme + logo",
      "1 workspace member",
      "Publish chatbot on your site"
    ],
    entitlements: CHATBOT_ENTITLEMENTS
  }
];

export function getPlanDefinition(planId: PlanId): PlanDefinition {
  return PLANS.find((plan) => plan.id === planId) ?? PLANS[0];
}

export function resolveEntitlements(planId: PlanId): Entitlements {
  return { ...getPlanDefinition(planId).entitlements };
}
