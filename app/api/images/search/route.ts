import { NextResponse } from "next/server";
import { searchPexels } from "@/lib/website-builder/images/pexels";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  const perPageParam = Number(searchParams.get("per_page") ?? "8");
  const perPage = Number.isFinite(perPageParam) ? Math.max(1, Math.min(20, perPageParam)) : 8;

  try {
    const results = await searchPexels(query, perPage);
    return NextResponse.json(results);
  } catch (error) {
    console.error("[PEXELS_SEARCH_ERROR]", error);
    return NextResponse.json({ error: "Image search failed" }, { status: 500 });
  }
}
