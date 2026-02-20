import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { getAdminBusinessesData } from "@/lib/admin/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "7d";
  const data = await getAdminBusinessesData(range);

  return NextResponse.json(data, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=60"
    }
  });
}
