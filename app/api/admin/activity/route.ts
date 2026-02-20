import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rangeStartIso = (range: string) => {
  const now = Date.now();
  if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
};

export async function GET(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const range = (url.searchParams.get("range") ?? "7d").trim();
  const businessId = (url.searchParams.get("business_id") ?? "all").trim();
  const eventType = (url.searchParams.get("event_type") ?? "all").trim();

  let query = (guard.supabase as any)
    .from("activity_events")
    .select("*")
    .gte("created_at", rangeStartIso(range))
    .order("created_at", { ascending: false })
    .limit(300);

  if (businessId !== "all") {
    query = query.eq("business_id", businessId);
  }
  if (eventType !== "all") {
    query = query.eq("event_type", eventType);
  }

  const [eventsResult, businessesResult] = await Promise.all([
    query,
    (guard.supabase as any).from("businesses").select("id, name, business_name").order("created_at", { ascending: false }).limit(500)
  ]);

  if (eventsResult.error) {
    return NextResponse.json({ error: eventsResult.error.message ?? "Failed to load activity feed." }, { status: 400 });
  }

  const businessMap = new Map<string, string>(
    (businessesResult.data ?? []).map((business: any) => [business.id, business.name ?? business.business_name ?? "Unknown business"])
  );

  const eventTypes = Array.from(new Set((eventsResult.data ?? []).map((event: any) => event.event_type))).sort();

  return NextResponse.json(
    {
      events: (eventsResult.data ?? []).map((event: any) => ({
        ...event,
        business_name: businessMap.get(event.business_id) ?? null
      })),
      businesses: Array.from(businessMap.entries()).map(([id, name]) => ({ id, name })),
      event_types: eventTypes
    },
    { status: 200 }
  );
}

