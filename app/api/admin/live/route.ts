import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { getAdminLiveData } from "@/lib/admin/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const data = await getAdminLiveData();

  return NextResponse.json(data, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=10, stale-while-revalidate=20"
    }
  });
}
