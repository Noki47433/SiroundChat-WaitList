import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { getAdminBusinessDetailData } from "@/lib/admin/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "90d";
  const data = await getAdminBusinessDetailData(params.id, range);

  if (!data) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  return NextResponse.json(data, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=60"
    }
  });
}
