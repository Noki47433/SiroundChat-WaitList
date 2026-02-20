import type {
  AccountProfile,
  AnalyticsSummary,
  BillingPlan,
  BillingState,
  BotSettings,
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
  DocumentItem,
  EmailReportSettings,
  OrgSummary,
  OverviewStat,
  ToneExamples,
  TonePreset,
  UserSummary
} from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { addDays, startOfDayInTimeZone } from "@/lib/utils/timezone";

const toneExamples: ToneExamples = {
  professional: [
    { question: "Do you offer onboarding?", answer: "Yes, onboarding is included with every plan." },
    { question: "What is your response time?", answer: "We respond instantly, with human escalation available." },
    { question: "Can I export chat logs?", answer: "Yes, transcripts can be exported from the dashboard." }
  ],
  friendly: [
    { question: "Do you offer onboarding?", answer: "Absolutely! We will walk your team through it." },
    { question: "What is your response time?", answer: "Super fast, usually under 10 seconds." },
    { question: "Can I export chat logs?", answer: "Yep! You can grab transcripts any time." }
  ],
  luxury: [
    { question: "Do you offer onboarding?", answer: "Of course. We provide a white-glove onboarding experience." },
    { question: "What is your response time?", answer: "Our concierge bot responds instantly, 24/7." },
    { question: "Can I export chat logs?", answer: "Yes, full transcripts are available on demand." }
  ],
  short_direct: [
    { question: "Do you offer onboarding?", answer: "Yes." },
    { question: "What is your response time?", answer: "Around 9 seconds." },
    { question: "Can I export chat logs?", answer: "Yes, from the dashboard." }
  ],
  energetic: [
    { question: "Do you offer onboarding?", answer: "Yep! We get you live fast." },
    { question: "What is your response time?", answer: "Lightning fast, under 10 seconds." },
    { question: "Can I export chat logs?", answer: "Totally! Export anytime." }
  ]
};

const botDefaults: BotSettings = {
  businessName: "SiroundChat",
  greeting: "Hi! I can help with demos, pricing, and support questions.",
  tone: "friendly",
  logoUrl: null
};

const emailReportDefaults: EmailReportSettings = {
  enabled: true,
  recipient: "reports@siroundchat.com",
  preview: {
    subject: "SiroundChat Monthly Summary",
    summary: "You resolved 0 conversations and captured 0 leads in the last 30 days.",
    highlights: ["Top channel: Website widget", "Best day: Friday", "Avg response: 9s"]
  }
};

const billingPlans: BillingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    features: ["1 chatbot", "Basic analytics", "Email support"]
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19/mo",
    features: ["Unlimited chats", "Advanced themes", "Lead capture", "Priority support"]
  }
];

const billingState: BillingState = {
  currentPlan: "starter",
  status: "pending",
  renewalDate: "2024-02-01"
};

const accountProfile: AccountProfile = {
  name: "Team Member",
  email: "team@siroundchat.com",
  timezone: "Europe/Skopje"
};

const EMAIL_REPORTS_KEY = "siroundchat.email-reports";
const BILLING_KEY = "siroundchat.billing";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readStorage = <T>(key: string, fallback: T): T => {
  if (!isBrowser()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeStorage = <T>(key: string, value: T) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const pad = (value: number) => value.toString().padStart(2, "0");

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDate(value)} ${formatTime(value)}`;
};

const formatBytes = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const formatDocType = (mimeType?: string | null, filename?: string | null) => {
  if (mimeType?.includes("pdf")) return "PDF";
  if (mimeType?.includes("word") || mimeType?.includes("doc")) return "DOCX";
  if (mimeType?.includes("text")) return "TXT";
  if (filename?.includes(".")) {
    const ext = filename.split(".").pop();
    if (ext) return ext.toUpperCase();
  }
  return "FILE";
};

const normalizeUuid = (value?: string | null) => (value ?? "").trim().replace(/[<>]/g, "");

const resolveTone = (tone?: string | null): TonePreset => {
  if (tone === "professional" || tone === "friendly" || tone === "luxury" || tone === "short_direct" || tone === "energetic") {
    return tone;
  }
  return "friendly";
};

const resolveStatus = (value?: string | null): "open" | "closed" => {
  if (!value) return "open";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "open";
  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 7 ? "closed" : "open";
};

type BusinessContext = {
  supabase: ReturnType<typeof getSupabaseBrowserClient>;
  user: { id: string; email?: string | null; user_metadata: Record<string, unknown> } | null;
  business: {
    id: string;
    business_name?: string | null;
    greeting?: string | null;
    tone?: string | null;
    logo_url?: string | null;
    industry?: string | null;
    timezone?: string | null;
  } | null;
};

const getBusinessContext = async (): Promise<BusinessContext> => {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, business: null };
  }

  let { data: business } = await supabase
    .from("businesses")
    .select("id, business_name, greeting, tone, logo_url, industry, timezone")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    const metadata = user.user_metadata ?? {};
    const rawBusinessName =
      typeof metadata.business_name === "string" && metadata.business_name.trim()
        ? metadata.business_name.trim()
        : typeof metadata.businessName === "string" && metadata.businessName.trim()
          ? metadata.businessName.trim()
          : typeof metadata.full_name === "string" && metadata.full_name.trim()
            ? `${metadata.full_name.trim()}'s Business`
            : user.email
              ? `${user.email.split("@")[0]}'s Business`
              : "Your business";
    const industry = typeof metadata.industry === "string" && metadata.industry.trim() ? metadata.industry.trim() : null;

    const { data: created } = await supabase
      .from("businesses")
      .insert({
        owner_id: user.id,
        business_name: rawBusinessName,
        industry
      })
      .select("id, business_name, greeting, tone, logo_url, industry, timezone")
      .single();

    business = created ?? null;
  }

  return { supabase, user: user as BusinessContext["user"], business: business ?? null };
};

const mapConversationSummary = (
  row: { id: string; user_name?: string | null; created_at: string; is_lead?: boolean | null },
  lastMessageAt?: string | null
): ConversationSummary => {
  const lastAt = lastMessageAt ?? row.created_at;
  return {
    id: row.id,
    visitorId: row.user_name ?? `Visitor-${row.id.slice(0, 4)}`,
    startedAt: formatDateTime(row.created_at),
    lastMessageAt: formatDateTime(lastAt),
    status: resolveStatus(lastAt),
    tags: row.is_lead ? ["lead"] : ["support"]
  };
};

const buildWeeklySeries = (dates: string[], timeZone: string) => {
  const now = new Date();
  const startOfToday = startOfDayInTimeZone(now, timeZone);
  const start = addDays(startOfToday, -6);

  const counts = new Map<string, number>();
  dates.forEach((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date < start) return;
    const dayStart = startOfDayInTimeZone(date, timeZone);
    const key = `${dayStart.getUTCFullYear()}-${pad(dayStart.getUTCMonth() + 1)}-${pad(dayStart.getUTCDate())}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const series: { label: string; value: number }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(start, i);
    const key = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
    series.push({
      label: day.toLocaleDateString("en-US", { weekday: "short", timeZone }),
      value: counts.get(key) ?? 0
    });
  }
  return series;
};

const mapSender = (sender: string): ConversationMessage["sender"] => {
  if (sender === "user") return "visitor";
  if (sender === "owner") return "owner";
  if (sender === "assistant" || sender === "ai") return "bot";
  return "agent";
};

export async function getOrgSummary(): Promise<OrgSummary> {
  const { supabase, business } = await getBusinessContext();
  if (!business) {
    return { id: "", name: "Your business", plan: "starter" };
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const plan = subscription?.plan === "pro" ? "pro" : "starter";

  return {
    id: business.id,
    name: business.business_name ?? "Your business",
    plan
  };
}

export async function getUserSummary(): Promise<UserSummary> {
  const { user } = await getBusinessContext();
  if (!user) {
    return { id: "", name: "Team Member", email: "", role: "Member" };
  }

  const metadata = user.user_metadata ?? {};
  const name =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (user.email ? user.email.split("@")[0] : "Team Member");

  return {
    id: user.id,
    name,
    email: user.email ?? "",
    role: "Admin"
  };
}

export async function getOverviewStats(): Promise<OverviewStat[]> {
  const { supabase, business } = await getBusinessContext();
  if (!business) {
    return [
      { label: "Conversations this month", value: "0", change: "No activity yet" },
      { label: "Leads captured", value: "0", change: "No leads yet" },
      { label: "Avg response time", value: "9s", change: "Below 15s target" },
      { label: "Bot status", value: "Active", change: "All systems normal" }
    ];
  }

  const { data: conversations } = await supabase
    .from("chat_conversations")
    .select("id, is_lead, created_at")
    .eq("business_id", business.id);

  const now = new Date();
  const conversationsThisMonth = (conversations ?? []).filter((row) => {
    const created = new Date(row.created_at);
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  }).length;
  const leadsCaptured = (conversations ?? []).filter((row) => row.is_lead).length;

  return [
    { label: "Conversations this month", value: String(conversationsThisMonth), change: "Based on live data" },
    { label: "Leads captured", value: String(leadsCaptured), change: "Tagged as leads" },
    { label: "Avg response time", value: "9s", change: "Below 15s target" },
    { label: "Bot status", value: "Active", change: "All systems normal" }
  ];
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const { supabase, business } = await getBusinessContext();
  if (!business) return [];

  const { data: conversations } = await supabase
    .from("chat_conversations")
    .select("id, user_name, created_at, is_lead")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const rows = conversations ?? [];
  if (!rows.length) return [];

  const { data: messageRows } = await supabase
    .from("chat_messages")
    .select("conversation_id, created_at")
    .in(
      "conversation_id",
      rows.map((row: { id: string }) => row.id)
    )
    .order("created_at", { ascending: false });

  const lastMessageMap = new Map<string, string>();
  (messageRows ?? []).forEach((row) => {
    if (!lastMessageMap.has(row.conversation_id)) {
      lastMessageMap.set(row.conversation_id, row.created_at);
    }
  });

  return rows.map((row: any) => mapConversationSummary(row, lastMessageMap.get(row.id)));
}

export async function getConversationDetail(id: string): Promise<ConversationDetail | null> {
  const { supabase, business } = await getBusinessContext();
  if (!business) return null;

  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id, user_name, created_at, is_lead")
    .eq("id", id)
    .eq("business_id", business.id)
    .single();

  if (!conversation) return null;

  const { data: messageRows } = await supabase
    .from("chat_messages")
    .select("id, sender, message_text, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const messages = (messageRows ?? []).map((row: any) => ({
    id: row.id,
    sender: mapSender(row.sender),
    text: row.message_text,
    timestamp: formatTime(row.created_at)
  }));

  const lastMessageAt = messageRows?.length ? messageRows[messageRows.length - 1]?.created_at : conversation.created_at;

  return {
    conversation: mapConversationSummary(conversation, lastMessageAt),
    messages
  };
}

export async function markConversationAsLead(id: string): Promise<ConversationSummary | null> {
  const { supabase, business } = await getBusinessContext();
  if (!business) return null;

  await supabase
    .from("chat_conversations")
    .update({ is_lead: true })
    .eq("id", id)
    .eq("business_id", business.id);

  const conversations = await getConversations();
  return conversations.find((conversation) => conversation.id === id) ?? null;
}

export async function getDocuments(): Promise<DocumentItem[]> {
  const { supabase, business } = await getBusinessContext();
  if (!business) return [];

  const db = supabase as any;
  const { data: docs } = await db
    .from("documents")
    .select("id, file_name, mime_type, size_bytes, created_at, status")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return (docs ?? []).map((doc: any) => ({
    id: doc.id,
    filename: doc.file_name,
    type: formatDocType(doc.mime_type, doc.file_name),
    size: formatBytes(doc.size_bytes),
    uploadedAt: formatDate(doc.created_at),
    status: doc.status === "ready" ? "ready" : "processing"
  }));
}

export async function uploadDocuments(files: File[]): Promise<DocumentItem[]> {
  const { business } = await getBusinessContext();
  if (!business || !files.length) return [];

  const formData = new FormData();
  const businessId = normalizeUuid(business.id);
  formData.append("businessId", businessId);
  files.forEach((file) => {
    formData.append("files", file, file.name);
  });

  const res = await fetch("/api/documents/upload", {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    return [];
  }

  const payload = await res.json().catch(() => null);
  const docs = (payload?.documents ?? []) as any[];

  return docs.map((doc: any) => ({
    id: doc.id,
    filename: doc.file_name,
    type: formatDocType(doc.mime_type, doc.file_name),
    size: formatBytes(doc.size_bytes),
    uploadedAt: formatDate(doc.created_at),
    status: doc.status === "ready" ? "ready" : "processing"
  }));
}

export async function deleteDocument(id: string): Promise<{ id: string }> {
  const { supabase, business } = await getBusinessContext();
  if (!business) return { id };

  const db = supabase as any;
  await db.from("documents").delete().eq("id", id).eq("business_id", business.id);
  return { id };
}

export async function retrainDocument(id: string): Promise<{ id: string; status: DocumentItem["status"] }> {
  const res = await fetch("/api/documents/retrain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId: id })
  });

  if (!res.ok) {
    return { id, status: "processing" };
  }

  const payload = await res.json().catch(() => null);
  if (payload?.ok) {
    return { id, status: "ready" };
  }

  return { id, status: "processing" };
}

export function updateDocumentStatus(id: string, status: DocumentItem["status"]) {
  if (!isBrowser()) return { id, status };
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  void db.from("documents").update({ status }).eq("id", id);
  return { id, status };
}

export async function getAnalyticsSummary(options: { debug?: boolean } = {}): Promise<AnalyticsSummary> {
  const { supabase, business } = await getBusinessContext();
  if (!business) {
    const emptySeries = buildWeeklySeries([], "UTC");
    return {
      uniqueVisitors: 0,
      conversations: 0,
      opens: 0,
      leads: 0,
      topQuestions: [],
      series: emptySeries,
      seriesByMetric: {
        conversations: emptySeries,
        opens: emptySeries,
        leads: emptySeries
      }
    };
  }

  const timeZone = business.timezone ?? "UTC";
  const { data: conversations } = await supabase
    .from("chat_conversations")
    .select("id, created_at")
    .eq("business_id", business.id);

  const conversationRows = conversations ?? [];
  const conversationIds = conversationRows.map((row: { id: string }) => row.id);
  const conversationSeries = buildWeeklySeries(
    conversationRows.map((row: { created_at: string }) => row.created_at),
    timeZone
  );

  const [{ count: opensCount }, { count: leadsCount }] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("type", "widget_opened"),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("type", "lead_created")
  ]);

  const startOfToday = startOfDayInTimeZone(new Date(), timeZone);
  const start = addDays(startOfToday, -6);
  const startIso = start.toISOString();

  const { data: recentEvents } = await supabase
    .from("analytics_events")
    .select("type, timestamp")
    .eq("business_id", business.id)
    .gte("timestamp", startIso)
    .in("type", ["widget_opened", "lead_created"]);

  const recentRows = recentEvents ?? [];
  const opensSeries = buildWeeklySeries(
    recentRows.filter((row: any) => row.type === "widget_opened").map((row: any) => row.timestamp),
    timeZone
  );
  const leadsSeries = buildWeeklySeries(
    recentRows.filter((row: any) => row.type === "lead_created").map((row: any) => row.timestamp),
    timeZone
  );

  let topQuestions: string[] = [];
  if (conversationIds.length) {
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("message_text")
      .in("conversation_id", conversationIds)
      .eq("sender", "user")
      .order("created_at", { ascending: false })
      .limit(20);

    const unique = new Set<string>();
    (messages ?? []).forEach((row) => {
      if (row.message_text && unique.size < 4) {
        unique.add(row.message_text);
      }
    });
    topQuestions = Array.from(unique);
  }

  let eventCounts: Record<string, number> | undefined;
  if (options.debug) {
    const { data: debugEvents } = await supabase
      .from("analytics_events")
      .select("type, timestamp")
      .eq("business_id", business.id)
      .gte("timestamp", startIso);

    const counts: Record<string, number> = {};
    (debugEvents ?? []).forEach((row: any) => {
      const type = row?.type as string;
      if (!type) return;
      counts[type] = (counts[type] ?? 0) + 1;
    });
    eventCounts = counts;
  }

  return {
    uniqueVisitors: opensCount ?? 0,
    conversations: conversationRows.length,
    opens: opensCount ?? 0,
    leads: leadsCount ?? 0,
    topQuestions,
    series: conversationSeries,
    seriesByMetric: {
      conversations: conversationSeries,
      opens: opensSeries,
      leads: leadsSeries
    },
    eventCounts
  };
}

export async function getEmailReportSettings(): Promise<EmailReportSettings> {
  const stored = readStorage(EMAIL_REPORTS_KEY, emailReportDefaults);
  return {
    ...stored,
    preview: { ...stored.preview, highlights: [...stored.preview.highlights] }
  };
}

export async function saveEmailReportSettings(settings: EmailReportSettings): Promise<EmailReportSettings> {
  writeStorage(EMAIL_REPORTS_KEY, settings);
  return {
    ...settings,
    preview: { ...settings.preview, highlights: [...settings.preview.highlights] }
  };
}

export async function sendEmailReport(recipient: string): Promise<{ success: boolean }> {
  return { success: Boolean(recipient) };
}

export async function getBotSettings(): Promise<{ settings: BotSettings; examples: ToneExamples }> {
  const { business } = await getBusinessContext();
  const settings = {
    businessName: business?.business_name ?? botDefaults.businessName,
    greeting: business?.greeting ?? botDefaults.greeting,
    tone: resolveTone(business?.tone),
    logoUrl: business?.logo_url ?? botDefaults.logoUrl ?? null
  };

  return { settings, examples: toneExamples };
}

export async function saveBotSettings(settings: BotSettings): Promise<BotSettings> {
  const { supabase, business } = await getBusinessContext();
  const logoUrl = settings.logoUrl && settings.logoUrl.startsWith("blob:") ? null : settings.logoUrl ?? null;
  const sanitized = { ...settings, logoUrl };

  if (business) {
    await supabase
      .from("businesses")
      .update({
        business_name: sanitized.businessName,
        greeting: sanitized.greeting,
        tone: sanitized.tone,
        logo_url: sanitized.logoUrl
      })
      .eq("id", business.id);
  }

  return sanitized;
}

export async function getBillingInfo(): Promise<{ plans: BillingPlan[]; state: BillingState }> {
  const stored = readStorage(BILLING_KEY, billingState);
  return { plans: billingPlans.map((plan) => ({ ...plan, features: [...plan.features] })), state: { ...stored } };
}

export async function upgradePlan(planId: BillingPlan["id"]): Promise<BillingState> {
  const next: BillingState = { currentPlan: planId, status: "pending", renewalDate: billingState.renewalDate };
  writeStorage(BILLING_KEY, next);
  return next;
}

export async function payByInvoice(): Promise<BillingState> {
  const next: BillingState = { ...billingState, status: "pending" };
  writeStorage(BILLING_KEY, next);
  return next;
}

export async function getAccountProfile(): Promise<AccountProfile> {
  return { ...accountProfile };
}

export async function saveAccountProfile(profile: AccountProfile): Promise<AccountProfile> {
  return { ...profile };
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  return { success: Boolean(email) };
}

export async function sendTranscriptEmail(recipient: string): Promise<{ success: boolean }> {
  return { success: Boolean(recipient) };
}

export const mockToneExamples = toneExamples;
