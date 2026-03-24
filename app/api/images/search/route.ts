import { NextResponse } from "next/server";
import { searchPexels } from "@/lib/website-builder/images/pexels";

export const runtime = "nodejs";

const LOCAL_PLACEHOLDERS = [
  "/images/placeholders/restaurant-hero.jpg",
  "/images/placeholders/restaurant-1.jpg",
  "/images/placeholders/restaurant-2.jpg",
  "/images/placeholders/restaurant-3.jpg"
];

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
    return NextResponse.json(
      LOCAL_PLACEHOLDERS.slice(0, perPage).map((url, index) => ({
        url,
        width: 1600,
        height: 1067,
        alt: `${query} placeholder ${index + 1}`,
        photographer: "SiroundChat Library",
        sourceUrl: url
      }))
    );
  }
}
