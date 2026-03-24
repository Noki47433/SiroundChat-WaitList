import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/server/business-auth";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 80;
const DEFAULT_GROUP_LIMIT = 5;
const MAX_GROUP_LIMIT = 10;

type ResultType = "navigation" | "conversation" | "lead" | "reservation";

type QuickSearchItem = {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  href: string;
  timestamp?: string | null;
};

type QuickSearchGroups = {
  navigation: QuickSearchItem[];
  conversations: QuickSearchItem[];
  leads: QuickSearchItem[];
  reservations: QuickSearchItem[];
};

type NavAction = {
  id: string;
  label: string;
  href: string;
  subtitle: string;
  keywords?: string[];
};

const NAV_ACTIONS: NavAction[] = [
  { id: "nav-overview", label: "Overview", href: "/dashboard", subtitle: "Business dashboard summary", keywords: ["home"] },
  { id: "nav-conversations", label: "Conversations", href: "/dashboard/conversations", subtitle: "Inbox and visitor chats", keywords: ["chat", "messages"] },
  { id: "nav-leads", label: "Leads", href: "/dashboard/leads", subtitle: "Captured contacts", keywords: ["crm", "prospects"] },
  { id: "nav-reservations", label: "Reservations", href: "/dashboard/reservations", subtitle: "Booking timeline", keywords: ["bookings", "calendar"] },
  { id: "nav-builder", label: "Website Builder", href: "/dashboard/builder", subtitle: "Build and publish pages", keywords: ["site", "website"] },
  { id: "nav-bot-settings", label: "Bot Settings", href: "/dashboard/bot-settings", subtitle: "Configure assistant behavior", keywords: ["assistant", "ai"] },
  { id: "nav-analytics", label: "Analytics", href: "/dashboard/analytics", subtitle: "Performance insights", keywords: ["metrics", "reports"] },
  { id: "nav-documents", label: "Documents", href: "/dashboard/documents", subtitle: "Knowledge uploads", keywords: ["knowledge", "files"] },
  { id: "nav-settings", label: "Settings", href: "/dashboard/settings", subtitle: "Workspace controls", keywords: ["preferences"] },
  { id: "nav-account", label: "Account", href: "/dashboard/account", subtitle: "User profile and session", keywords: ["profile"] },
  { id: "nav-billing", label: "Billing", href: "/billing", subtitle: "Plans and payments", keywords: ["subscription", "invoice"] }
];

const QUICK_ACTION_IDS = [
  "nav-conversations",
  "nav-leads",
  "nav-reservations",
  "nav-analytics",
  "nav-builder",
  "nav-settings",
  "nav-billing"
];

const escapeForIlike = (value: string) =>
  value
    .replace(/[%,_*]/g, " ")
    .replace(/['",()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalize = (value: string) => value.trim().toLowerCase();

const navScore = (item: NavAction, query: string) => {
  const label = item.label.toLowerCase();
  const href = item.href.toLowerCase();
  const keywords = item.keywords?.join(" ").toLowerCase() ?? "";

  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (keywords.startsWith(query)) return 2;
  if (label.includes(query)) return 3;
  if (keywords.includes(query)) return 4;
  if (href.includes(query)) return 5;
  return 99;
};

const mapNavigation = (item: NavAction): QuickSearchItem => ({
  id: item.id,
  type: "navigation",
  title: item.label,
  subtitle: item.subtitle,
  href: item.href
});

export async function GET(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get("q") ?? "").trim();
  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: `Query too long (max ${MAX_QUERY_LENGTH} chars)` }, { status: 400 });
  }

  const requestedLimit = Number(url.searchParams.get("limit") ?? DEFAULT_GROUP_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(Math.floor(requestedLimit), MAX_GROUP_LIMIT))
    : DEFAULT_GROUP_LIMIT;

  const normalizedQuery = normalize(rawQuery);
  const safeLikeQuery = escapeForIlike(rawQuery);
  const hasSearch = Boolean(normalizedQuery && safeLikeQuery);
  const supabase = context.supabase as any;

  const navigation = hasSearch
    ? NAV_ACTIONS
        .filter((item) => {
          const haystack = `${item.label} ${item.href} ${item.keywords?.join(" ") ?? ""}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        })
        .sort((a, b) => navScore(a, normalizedQuery) - navScore(b, normalizedQuery) || a.label.localeCompare(b.label))
        .slice(0, limit)
        .map(mapNavigation)
    : QUICK_ACTION_IDS
        .map((id) => NAV_ACTIONS.find((item) => item.id === id))
        .filter((item): item is NavAction => Boolean(item))
        .slice(0, limit)
        .map(mapNavigation);

  let conversationsQuery = supabase
    .from("chat_conversations")
    .select("id,user_name,created_at")
    .eq("business_id", context.businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (hasSearch) {
    conversationsQuery = conversationsQuery.or(`user_name.ilike.%${safeLikeQuery}%,id.ilike.%${safeLikeQuery}%`);
  }

  let leadsQuery = supabase
    .from("leads")
    .select("id,name,email,phone,created_at")
    .eq("business_id", context.businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (hasSearch) {
    leadsQuery = leadsQuery.or(`name.ilike.%${safeLikeQuery}%,email.ilike.%${safeLikeQuery}%,phone.ilike.%${safeLikeQuery}%`);
  }

  let reservationsQuery = supabase
    .from("reservations")
    .select("id,customer_name,customer_email,customer_phone,created_at")
    .eq("business_id", context.businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (hasSearch) {
    reservationsQuery = reservationsQuery.or(
      `customer_name.ilike.%${safeLikeQuery}%,customer_email.ilike.%${safeLikeQuery}%,customer_phone.ilike.%${safeLikeQuery}%`
    );
  }

  const [conversationsResult, leadsResult, reservationsResult] = await Promise.all([
    conversationsQuery,
    leadsQuery,
    reservationsQuery
  ]);

  if (conversationsResult.error || leadsResult.error || reservationsResult.error) {
    const message =
      conversationsResult.error?.message ?? leadsResult.error?.message ?? reservationsResult.error?.message ?? "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const groups: QuickSearchGroups = {
    navigation,
    conversations: ((conversationsResult.data ?? []) as Array<{ id: string; user_name?: string | null; created_at: string }>).map(
      (row) => ({
        id: `conversation-${row.id}`,
        type: "conversation",
        title: row.user_name?.trim() || `Visitor ${row.id.slice(0, 6)}`,
        subtitle: "Conversation",
        href: `/dashboard/conversations/${row.id}`,
        timestamp: row.created_at
      })
    ),
    leads: ((leadsResult.data ?? []) as Array<{ id: string; name?: string | null; email?: string | null; phone?: string | null; created_at: string }>).map(
      (row) => ({
        id: `lead-${row.id}`,
        type: "lead",
        title: row.name?.trim() || row.email?.trim() || row.phone?.trim() || `Lead ${row.id.slice(0, 6)}`,
        subtitle: [row.email?.trim(), row.phone?.trim()].filter(Boolean).join(" • ") || "Lead",
        href: "/dashboard/leads",
        timestamp: row.created_at
      })
    ),
    reservations: ((reservationsResult.data ?? []) as Array<{
      id: string;
      customer_name?: string | null;
      customer_email?: string | null;
      customer_phone?: string | null;
      created_at: string;
    }>).map((row) => ({
      id: `reservation-${row.id}`,
      type: "reservation",
      title: row.customer_name?.trim() || row.customer_email?.trim() || row.customer_phone?.trim() || `Reservation ${row.id.slice(0, 6)}`,
      subtitle: "Reservation",
      href: "/dashboard/reservations",
      timestamp: row.created_at
    }))
  };

  return NextResponse.json({ query: rawQuery, groups });
}
