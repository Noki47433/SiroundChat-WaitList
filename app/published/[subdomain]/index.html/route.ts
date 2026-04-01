import { NextResponse } from "next/server";
import { buildPublishedSiteUrl } from "@/lib/utils/published-site-url";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { subdomain: string } }) {
  const subdomain = params.subdomain?.trim();
  if (!subdomain) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(buildPublishedSiteUrl(subdomain), 308);
}
