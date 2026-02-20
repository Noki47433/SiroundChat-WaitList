import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { log } from "@/lib/utils/log";

const RANGE_MAP: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90
};

const toPercent = (numerator: number, denominator: number) => {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
};

const sumNumeric = (values: Array<number | null | undefined>) =>
  values.reduce<number>(
    (total, value) => total + (typeof value === "number" && Number.isFinite(value) ? value : 0),
    0
  );

export async function GET(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const supabase = context.supabase as any;
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "30d";
  const days = RANGE_MAP[range] ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      reservationStarted,
      reservationCompleted,
      upsellShown,
      upsellAccepted,
      offerSentRows,
      offerRedeemedRows,
      revenueEvents,
      offerRevenueRows,
      leadRows
    ] = await Promise.all([
      supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("business_id", context.businessId)
        .eq("type", "reservation_started")
        .gte("timestamp", since),
      supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("business_id", context.businessId)
        .in("type", ["reservation_completed", "reservation_created"])
        .gte("timestamp", since),
      supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("business_id", context.businessId)
        .eq("type", "upsell_shown")
        .gte("timestamp", since),
      supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("business_id", context.businessId)
        .eq("type", "upsell_accepted")
        .gte("timestamp", since),
      supabase
        .from("offers")
        .select("id,sent_at")
        .eq("business_id", context.businessId)
        .gte("sent_at", since),
      supabase
        .from("offers")
        .select("id,redeemed_at")
        .eq("business_id", context.businessId)
        .not("redeemed_at", "is", null)
        .gte("redeemed_at", since),
      supabase
        .from("analytics_events")
        .select("value_numeric,type")
        .eq("business_id", context.businessId)
        .in("type", ["upsell_accepted", "offer_redeemed"])
        .gte("timestamp", since),
      supabase
        .from("offers")
        .select("revenue_attributed")
        .eq("business_id", context.businessId)
        .gte("sent_at", since),
      supabase
        .from("lead_qualifications")
        .select("status")
        .eq("business_id", context.businessId)
        .gte("created_at", since)
    ]);

    const startedCount = reservationStarted.count ?? 0;
    const completedCount = reservationCompleted.count ?? 0;
    const upsellShownCount = upsellShown.count ?? 0;
    const upsellAcceptedCount = upsellAccepted.count ?? 0;
    const offerSentCount = (offerSentRows.data ?? []).length;
    const offerRedeemedCount = (offerRedeemedRows.data ?? []).length;

    const revenueFromEvents = sumNumeric((revenueEvents.data ?? []).map((row: any) => Number(row.value_numeric ?? 0)));
    const revenueFromOffers = sumNumeric((offerRevenueRows.data ?? []).map((row: any) => Number(row.revenue_attributed ?? 0)));

    const leadFunnel = {
      hot: 0,
      warm: 0,
      cold: 0
    };

    for (const row of leadRows.data ?? []) {
      const status = row.status as "hot" | "warm" | "cold";
      if (status === "hot" || status === "warm" || status === "cold") {
        leadFunnel[status] += 1;
      }
    }

    return NextResponse.json({
      range,
      metrics: {
        reservations: {
          started: startedCount,
          completed: completedCount,
          conversionRate: toPercent(completedCount, startedCount)
        },
        upsells: {
          shown: upsellShownCount,
          accepted: upsellAcceptedCount,
          acceptanceRate: toPercent(upsellAcceptedCount, upsellShownCount)
        },
        offers: {
          sent: offerSentCount,
          redeemed: offerRedeemedCount,
          redemptionRate: toPercent(offerRedeemedCount, offerSentCount)
        },
        revenueAttributed: Number((revenueFromEvents + revenueFromOffers).toFixed(2)),
        leadFunnel
      }
    });
  } catch (error) {
    log("error", "Failed to load analytics metrics", { error, businessId: context.businessId, range, since });
    return NextResponse.json({ error: "Failed to load analytics metrics" }, { status: 500 });
  }
}
