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
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { addDays, startOfDayInTimeZone } from "@/lib/utils/timezone";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";

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
  supabase: ReturnType<typeof getSupabaseServerClient>;
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
  const supabase = getSupabaseServerClient();
  const tenant = await getTenantFromSession();

  if (!tenant.userId || !tenant.businessId) {
    return { supabase, user: null, business: null };
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_name, greeting, tone, logo_url, industry, timezone")
    .eq("id", tenant.businessId)
    .single();

  const {
    data: { user }
  } = await supabase.auth.getUser();

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
  const { business } = await getBusinessContext();
  if (!business) {
    return { id: "", name: "Your business", plan: "starter" };
  }

  const subscription = await getWorkspaceSubscription(business.id);
  const plan =
    subscription.status === "trialing" ||
    subscription.status === "active" ||
    subscription.status === "past_due" ||
    subscription.status === "pending_setup"
      ? "pro"
      : "starter";

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
  const conversationsThisMonth = (conversations ?? []).filter((row: any) => {
    const created = new Date(row.created_at);
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  }).length;
  const leadsCaptured = (conversations ?? []).filter((row: any) => row.is_lead).length;

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
      rows.map((row: any) => row.id)
    )
    .order("created_at", { ascending: false });

  const lastMessageMap = new Map<string, string>();
  (messageRows ?? []).forEach((row: any) => {
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
  const conversationIds = conversationRows.map((row: any) => row.id);
  const conversationSeries = buildWeeklySeries(
    conversationRows.map((row: any) => row.created_at),
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
    (messages ?? []).forEach((row: any) => {
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
  return {
    ...emailReportDefaults,
    preview: { ...emailReportDefaults.preview, highlights: [...emailReportDefaults.preview.highlights] }
  };
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

export async function getBillingInfo(): Promise<{ plans: BillingPlan[]; state: BillingState }> {
  return {
    plans: billingPlans.map((plan: BillingPlan) => ({ ...plan, features: [...plan.features] })),
    state: { ...billingState }
  };
}

export async function getAccountProfile(): Promise<AccountProfile> {
  const { user } = await getBusinessContext();
  if (!user) return { ...accountProfile };
  const metadata = user.user_metadata ?? {};
  return {
    name: (typeof metadata.full_name === "string" && metadata.full_name.trim()) || accountProfile.name,
    email: user.email ?? accountProfile.email,
    timezone: accountProfile.timezone
  };
}
