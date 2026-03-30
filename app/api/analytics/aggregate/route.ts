// Summary: Mock analytics aggregation endpoint used by dashboards for demo data. Secondary—useful to know it returns fake stats.
import { NextResponse } from "next/server";
import { AnalyticsAggregateQuerySchema } from "@/lib/validation/analytics";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const parsed = AnalyticsAggregateQuerySchema.safeParse({
    siteId: url.searchParams.get("siteId"),
    range: url.searchParams.get("range") ?? "30d"
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const visits = Array.from({ length: 7 }).map((_, idx) => ({
    date: `Day ${idx + 1}`,
    count: Math.floor(Math.random() * 50) + 5
  }));

  return NextResponse.json({
    visits,
    chats: visits.map((point) => ({ ...point, count: Math.floor(point.count * 0.4) })),
    leads: visits.map((point) => ({ ...point, count: Math.floor(point.count * 0.2) })),
    conversionRate: 0.23
  });
}
