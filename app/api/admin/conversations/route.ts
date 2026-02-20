import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { getAdminConversationsData } from "@/lib/admin/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const data = await getAdminConversationsData({
    businessId: searchParams.get("businessId"),
    status: searchParams.get("status"),
    from: searchParams.get("from"),
    to: searchParams.get("to")
  });

  return NextResponse.json({ rows: data }, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=15, stale-while-revalidate=30"
    }
  });
}
