export type LeadLike = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  conversation_id?: string | null;
  source?: string | null;
  lead_type?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
};

const LEAD_FIELD_LABELS: Record<string, string> = {
  owner_name: "Owner name",
  business_name: "Business name",
  business_type: "Business type",
  website_url: "Website",
  instagram_url: "Instagram",
  company_name: "Company name",
  job_title: "Job title",
  monthly_volume: "Monthly volume",
  budget_range: "Budget range",
  service_interest: "Service interest",
  preferred_contact_method: "Preferred contact method",
  preferred_time: "Preferred time",
  note: "Note"
};

const HIDDEN_PAYLOAD_KEYS = new Set([
  "source",
  "site_id",
  "submission_id",
  "form_type",
  "message",
  "name",
  "email",
  "phone",
  "conversation_id"
]);

const titleCase = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatLeadDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export const formatLeadRelativeTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatLeadDateTime(value);
};

export const resolveLeadName = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  return trimmed || "Website visitor";
};

export const getLeadMessage = (lead: Pick<LeadLike, "payload">) => {
  const payload =
    lead.payload && typeof lead.payload === "object" && !Array.isArray(lead.payload)
      ? (lead.payload as Record<string, unknown>)
      : null;

  return typeof payload?.message === "string" && payload.message.trim().length > 0 ? payload.message.trim() : null;
};

export const getLeadPayloadEntries = (lead: Pick<LeadLike, "payload">) => {
  const payload =
    lead.payload && typeof lead.payload === "object" && !Array.isArray(lead.payload)
      ? (lead.payload as Record<string, unknown>)
      : null;

  if (!payload) return [];

  return Object.entries(payload)
    .filter(([key, value]) => !HIDDEN_PAYLOAD_KEYS.has(key) && value != null && value !== "")
    .map(([key, value]) => ({
      key,
      label: LEAD_FIELD_LABELS[key] ?? titleCase(key),
      value: Array.isArray(value) ? value.join(", ") : String(value)
    }));
};

export const getLeadPresentation = (lead: Pick<LeadLike, "id" | "conversation_id" | "lead_type" | "source" | "email" | "phone">) => {
  const leadType = (lead.lead_type ?? "").trim().toLowerCase();
  const source = (lead.source ?? "").trim().toLowerCase();
  const hasConversation = Boolean(lead.conversation_id);
  const hasEmail = Boolean(lead.email?.trim());
  const hasPhone = Boolean(lead.phone?.trim());

  if (hasConversation || leadType === "chat" || source === "widget") {
    return {
      kindLabel: "Chatbot Lead",
      kindVariant: "info" as const,
      sourceLabel: "Chat widget",
      statusLabel: hasConversation ? "Conversation linked" : "Chat captured",
      contactLabel: hasEmail && hasPhone ? "Email + phone" : hasEmail || hasPhone ? "One contact method" : "No direct contact",
      actionLabel: "View conversation",
      href: hasConversation ? `/dashboard/conversations/${lead.conversation_id}` : "/dashboard/conversations",
      summary: "Captured after a visitor shared details in the chatbot."
    };
  }

  if (leadType === "contact_form" || source === "website_form") {
    return {
      kindLabel: "Contact Form",
      kindVariant: "warning" as const,
      sourceLabel: "Website form",
      statusLabel: "Submission received",
      contactLabel: hasEmail && hasPhone ? "Email + phone" : hasEmail || hasPhone ? "One contact method" : "No direct contact",
      actionLabel: "Open lead",
      href: `/dashboard/leads/${lead.id}`,
      summary: "Submitted directly through a website contact form."
    };
  }

  return {
    kindLabel: "Website Lead",
    kindVariant: "default" as const,
    sourceLabel: "Website",
    statusLabel: "Needs review",
    contactLabel: hasEmail && hasPhone ? "Email + phone" : hasEmail || hasPhone ? "One contact method" : "No direct contact",
    actionLabel: "Open lead",
    href: `/dashboard/leads/${lead.id}`,
    summary: "Captured from a website lead flow."
  };
};
