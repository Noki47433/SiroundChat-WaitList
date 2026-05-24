import {
  getPlanDefinition,
  type EntitlementKey,
  type PlanId
} from "@/src/billing/plans";

export type UpgradeCopy = {
  entitlementKey: EntitlementKey;
  recommendedPlanId: PlanId;
  title: string;
  description: string;
  highlights: string[];
};

const DEFAULT_COPY: Omit<UpgradeCopy, "entitlementKey"> = {
  recommendedPlanId: "omni_channel",
  title: "Upgrade to unlock this workspace capability",
  description: "Your current subscription does not include this part of SiroundChat yet.",
  highlights: ["Secure access controls", "Server-enforced modules", "A cleaner operating flow"]
};

const COPY_MAP: Partial<Record<EntitlementKey, Omit<UpgradeCopy, "entitlementKey">>> = {
  website_builder: {
    recommendedPlanId: "website_only",
    title: "Build and publish your restaurant website",
    description:
      "Website creation, sections, branding, and publishing are available on Website Only, Website + AI, and Full Omni-Channel.",
    highlights: ["Website builder", "Publishing", "Brand and contact setup"]
  },
  publish_website: {
    recommendedPlanId: "website_only",
    title: "Publish your SiroundChat website",
    description:
      "Website publishing is available on Website Only, Website + AI, and Full Omni-Channel.",
    highlights: ["Publish live", "Custom domain readiness", "Website operations"]
  },
  custom_domain: {
    recommendedPlanId: "website_only",
    title: "Connect a custom domain",
    description:
      "Custom domain support is part of the website plans so your restaurant brand looks fully owned end to end.",
    highlights: ["Custom domain", "Brand trust", "Live website delivery"]
  },
  chatbot: {
    recommendedPlanId: "chatbot_only",
    title: "Activate your AI chatbot",
    description:
      "AI replies, lead capture, knowledge-based answers, and automated customer support are available on AI Chatbot Only, Website + AI, and Full Omni-Channel.",
    highlights: ["AI replies", "Lead capture", "Knowledge-backed support"]
  },
  chatbot_embed: {
    recommendedPlanId: "chatbot_only",
    title: "Publish your chatbot outside SiroundChat websites",
    description:
      "External chatbot embeds are available on AI Chatbot Only, Website + AI, and Full Omni-Channel.",
    highlights: ["External embed", "Widget branding", "Knowledge-driven replies"]
  },
  chatbot_website_injection: {
    recommendedPlanId: "website_chatbot",
    title: "Attach the chatbot directly to your website",
    description:
      "Chatbot-on-website experiences are available on Website + AI and Full Omni-Channel.",
    highlights: ["Website + chatbot together", "On-page support", "Unified lead flow"]
  },
  chatbot_knowledge_base: {
    recommendedPlanId: "chatbot_only",
    title: "Train the chatbot on your business content",
    description:
      "Knowledge base uploads and grounded answers are available on AI Chatbot Only, Website + AI, and Full Omni-Channel.",
    highlights: ["Document uploads", "Grounded answers", "Business-specific knowledge"]
  },
  chatbot_actions: {
    recommendedPlanId: "chatbot_only",
    title: "Automate customer follow-up",
    description:
      "Chatbot actions and response automation are available on AI Chatbot Only, Website + AI, and Full Omni-Channel.",
    highlights: ["Automation rules", "Lead routing", "Operational handoff"]
  },
  advanced_analytics: {
    recommendedPlanId: "website_chatbot",
    title: "See the full conversion picture",
    description:
      "Deeper analytics are available on Website + AI and Full Omni-Channel for restaurants that want to track how traffic, chats, and leads actually convert.",
    highlights: ["Traffic and conversion insight", "Lead funnel visibility", "Operational reporting"]
  },
  unified_inbox: {
    recommendedPlanId: "social_inbox",
    title: "Run WhatsApp and Instagram from one inbox",
    description:
      "The unified social inbox is available on Social Inbox and Full Omni-Channel.",
    highlights: ["Unified inbox", "Shared conversation view", "Faster response handling"]
  },
  whatsapp: {
    recommendedPlanId: "social_inbox",
    title: "Unlock WhatsApp messaging and automation",
    description:
      "WhatsApp connectivity, replies, and inbox operations are available on Social Inbox and Full Omni-Channel.",
    highlights: ["WhatsApp connection", "Replies and handoff", "Channel automation"]
  },
  instagram: {
    recommendedPlanId: "social_inbox",
    title: "Unlock Instagram messaging and automation",
    description:
      "Instagram DM management is available on Social Inbox and Full Omni-Channel.",
    highlights: ["Instagram DM handling", "Unified support flow", "Operational visibility"]
  },
  channel_settings: {
    recommendedPlanId: "social_inbox",
    title: "Configure social channels",
    description:
      "Channel setup, connection management, and social inbox controls are available on Social Inbox and Full Omni-Channel.",
    highlights: ["Channel settings", "Connection status", "Auto-reply controls"]
  },
  social_automation: {
    recommendedPlanId: "social_inbox",
    title: "Automate paid social conversations",
    description:
      "Social automation is available on Social Inbox and Full Omni-Channel.",
    highlights: ["Automated replies", "Inbox workflows", "Channel operations"]
  },
  social_replies: {
    recommendedPlanId: "social_inbox",
    title: "Reply from the social inbox",
    description:
      "Sending WhatsApp and Instagram replies from SiroundChat is available on Social Inbox and Full Omni-Channel.",
    highlights: ["Reply tools", "Conversation control", "Operational follow-up"]
  },
  reservations: {
    recommendedPlanId: "website_chatbot",
    title: "Enable reservations inside your workspace",
    description:
      "Reservation capture and management are available on plans that include customer-facing website or chatbot flows.",
    highlights: ["Reservation capture", "Availability workflow", "Guest operations"]
  },
  reservation_management: {
    recommendedPlanId: "website_chatbot",
    title: "Manage reservations without friction",
    description:
      "Reservation operations are available on plans built for website or chatbot-driven guest experiences.",
    highlights: ["Reservation dashboard", "Capacity controls", "Guest follow-up"]
  },
  export_data: {
    recommendedPlanId: "website_chatbot",
    title: "Export operational data",
    description:
      "Exports are available on the higher plans where lead, conversation, and operational reporting become part of the core workflow.",
    highlights: ["CSV exports", "Operational reporting", "Revenue visibility"]
  }
};

export function getRecommendedUpgradePlan(entitlementKey: EntitlementKey): PlanId {
  return (COPY_MAP[entitlementKey] ?? DEFAULT_COPY).recommendedPlanId;
}

export function getUpgradeCopy(entitlementKey: EntitlementKey): UpgradeCopy {
  const resolved = COPY_MAP[entitlementKey] ?? DEFAULT_COPY;
  return {
    entitlementKey,
    ...resolved
  };
}

export function getUpgradeHref(entitlementKey: EntitlementKey) {
  return `/billing?blocked=${encodeURIComponent(entitlementKey)}`;
}

export function getRecommendedPlanName(entitlementKey: EntitlementKey) {
  return getPlanDefinition(getRecommendedUpgradePlan(entitlementKey)).name;
}
