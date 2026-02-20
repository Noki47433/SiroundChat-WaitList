import { NextRequest, NextResponse } from "next/server";

const BLOCKED_PREFIXES = ["/dashboard", "/admin", "/builder", "/chatbot", "/app"];

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  if (BLOCKED_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("blocked", "1");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/builder/:path*", "/chatbot/:path*", "/app/:path*"]
};
