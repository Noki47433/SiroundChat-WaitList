import { NextRequest, NextResponse } from "next/server";

const hasAuthCookie = (request: NextRequest) =>
  request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name === "supabase-auth-token" ||
        (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))
    );

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true" || process.env.DISABLE_AUTH === "true") {
    return NextResponse.next();
  }

  if (hasAuthCookie(request)) {
    return NextResponse.next();
  }

  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const redirectUrl = new URL("/auth", request.url);
  redirectUrl.searchParams.set("next", next);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"]
};
