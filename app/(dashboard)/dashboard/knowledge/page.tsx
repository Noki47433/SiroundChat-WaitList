import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { getRollingRangeInTimeZone } from "@/lib/utils/timezone";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";
import {
  KnowledgePanel,
  type BusinessTopicItem,
  type FaqItem
} from "@/app/(dashboard)/dashboard/_components/KnowledgePanel";

export const dynamic = "force-dynamic";

const PRESET_TOPICS: Record<string, string[]> = {
  restaurants: [
    "vegan",
    "halal",
    "gluten",
    "delivery",
    "menu",
    "hours",
    "location",
    "parking",
    "reservation",
    "price"
  ],
  barbers: ["price", "appointment", "walk-in", "hours", "location", "styles"],
  dentists: ["appointment", "price", "emergency", "hours", "location", "insurance"],
  hotels: ["check-in", "check-out", "breakfast", "parking", "price", "availability"],
  car_dealerships: ["financing", "warranty", "price", "availability", "test drive"],
  general: ["price", "hours", "location", "contact", "booking"]
};

const resolvePresetTopics = (industry?: string | null) => {
  const value = (industry ?? "").toLowerCase();
  if (value.includes("restaurant") || value.includes("food") || value.includes("cafe") || value.includes("bar")) {
    return PRESET_TOPICS.restaurants;
  }
  if (value.includes("barber") || value.includes("salon")) {
    return PRESET_TOPICS.barbers;
  }
  if (value.includes("dentist")) {
    return PRESET_TOPICS.dentists;
  }
  if (value.includes("hotel")) {
    return PRESET_TOPICS.hotels;
  }
  if (value.includes("car") || value.includes("auto") || value.includes("dealership")) {
    return PRESET_TOPICS.car_dealerships;
  }
  return PRESET_TOPICS.general;
};

export default async function KnowledgePage() {
  const access = await getEntitlementAccess("chatbot_knowledge_base");
  if (!access.allowed) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Knowledge</p>
          <h2 className="mt-2 text-3xl font-semibold">Sharpen your chatbot answers</h2>
          <p className="mt-2 text-sm text-white/60">
            Track visitor topics and keep FAQs fresh to reduce unanswered questions.
          </p>
        </div>
        <UpgradeOverlay
          entitlementKey="chatbot_knowledge_base"
          title="Upgrade plan to unlock Knowledge Base"
          description="Knowledge topics and FAQ grounding are available on plans with chatbot knowledge base."
        >
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="h-4 w-60 rounded bg-white/10" />
            <div className="h-3 w-80 rounded bg-white/10" />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="h-40 rounded-2xl border border-white/10 bg-neutral-900/60" />
              <div className="h-40 rounded-2xl border border-white/10 bg-neutral-900/60" />
            </div>
          </div>
        </UpgradeOverlay>
      </div>
    );
  }

  const tenant = await getTenantFromSession();
  const supabase = getSupabaseServerClient();

  if (!tenant.businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Knowledge</p>
        <h2 className="text-3xl font-semibold">Organize answers in one place</h2>
        <p className="text-sm text-white/60">Log in to manage topics and FAQs.</p>
      </div>
    );
  }

  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id, industry, timezone")
    .eq("id", tenant.businessId)
    .maybeSingle();

  if (!business?.id) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Knowledge</p>
        <h2 className="text-3xl font-semibold">Organize answers in one place</h2>
        <p className="text-sm text-white/60">No business found for this account.</p>
      </div>
    );
  }

  const businessId = business.id as string;
  let { data: topics } = await (supabase as any)
    .from("business_topics")
    .select("id, topic, keywords, enabled")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (!topics || topics.length === 0) {
    const presets = resolvePresetTopics(business.industry).map((topic) => ({
      business_id: businessId,
      topic,
      keywords: [],
      enabled: true
    }));

    if (presets.length) {
      await (supabase as any)
        .from("business_topics")
        .insert(presets, { onConflict: "business_id,topic", ignoreDuplicates: true });
    }

    const { data: seededTopics } = await (supabase as any)
      .from("business_topics")
      .select("id, topic, keywords, enabled")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    topics = seededTopics ?? [];
  }

  const { data: faqs } = await (supabase as any)
    .from("business_faq_items")
    .select("id, question, answer, created_at, updated_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const timeZone = (business.timezone as string | null) ?? "UTC";
  const { start } = getRollingRangeInTimeZone(timeZone, 7);
  const { data: topicEvents } = await (supabase as any)
    .from("analytics_events")
    .select("metadata")
    .eq("business_id", businessId)
    .eq("type", "topic_mentioned")
    .gte("timestamp", start.toISOString());

  const topicCounts = new Map<string, number>();
  (topicEvents ?? []).forEach((event: any) => {
    const topic = event?.metadata?.topic;
    if (typeof topic !== "string" || !topic.trim()) return;
    topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  });

  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic, count]) => ({ topic, count }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Knowledge</p>
        <h2 className="mt-2 text-3xl font-semibold">Sharpen your chatbot answers</h2>
        <p className="mt-2 text-sm text-white/60">
          Track visitor topics and keep FAQs fresh to reduce unanswered questions.
        </p>
      </div>

      <KnowledgePanel
        businessId={businessId}
        initialTopics={(topics ?? []) as BusinessTopicItem[]}
        initialFaqs={(faqs ?? []) as FaqItem[]}
        topTopics={topTopics}
      />
    </div>
  );
}
