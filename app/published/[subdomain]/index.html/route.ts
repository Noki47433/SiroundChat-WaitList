import { NextResponse } from "next/server";
import { getSupabasePublicClient } from "@/lib/supabase/server";
import { BUILDER_SITES_BUCKET } from "@/lib/builder/storage";

export const runtime = "nodejs";
const CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(_request: Request, { params }: { params: { subdomain: string } }) {
  const subdomain = params.subdomain?.trim();
  if (!subdomain) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = getSupabasePublicClient();
  const storagePath = `published/${subdomain}/index.html`;
  const { data, error } = await supabase.storage.from(BUILDER_SITES_BUCKET).download(storagePath);

  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = await data.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": CACHE_CONTROL
    }
  });
}
