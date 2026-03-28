import { NextRequest, NextResponse } from "next/server";
import { isPrelaunchModeEnabled } from "@/lib/auth/prelaunch";

const hasAuthCookie = (request: NextRequest) =>
  request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name === "supabase-auth-token" ||
        (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))
    );

const PRIVATE_PAGE_PREFIXES = ["/dashboard", "/billing", "/admin", "/editor"];

const PRIVATE_API_EXACT_PATHS = new Set([
  "/api/automations",
  "/api/billing/start-trial",
  "/api/billing/subscription",
  "/api/bot-settings",
  "/api/chat/history",
  "/api/chat/owner-send",
  "/api/chat/rag",
  "/api/chat/takeover",
  "/api/chatbot/sales",
  "/api/dashboard/quick-search",
  "/api/feedback",
  "/api/impact/compute",
  "/api/impact/latest",
  "/api/impact/mark-shown",
  "/api/knowledge/ingest",
  "/api/logos/upload",
  "/api/onboarding/restaurant",
  "/api/reservations/list",
  "/api/reservations/settings",
  "/api/reservations/update-status"
]);

const PRIVATE_API_PREFIXES = [
  "/api/admin/",
  "/api/announcements/",
  "/api/analytics/matter",
  "/api/analytics/website",
  "/api/builder/",
  "/api/channels/",
  "/api/crm/",
  "/api/documents/",
  "/api/domain/",
  "/api/notifications/"
];

const PRIVATE_API_PATTERNS = [/^\/api\/feedback\/[^/]+$/, /^\/api\/reservations\/[^/]+\/update$/];

const isPrivatePagePath = (pathname: string) => PRIVATE_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const isPrivateApiPath = (pathname: string) =>
  PRIVATE_API_EXACT_PATHS.has(pathname) ||
  PRIVATE_API_PREFIXES.some((prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix)) ||
  PRIVATE_API_PATTERNS.some((pattern) => pattern.test(pathname));

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPrivatePage = isPrivatePagePath(pathname);
  const isPrivateApi = isPrivateApiPath(pathname);

  if (!isPrivatePage && !isPrivateApi) {
    return NextResponse.next();
  }

  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true" || process.env.DISABLE_AUTH === "true") {
    return NextResponse.next();
  }

  if (hasAuthCookie(request)) {
    return NextResponse.next();
  }

  if (isPrivateApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isPrelaunchModeEnabled()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const next = `${pathname}${search}`;
  const redirectUrl = new URL("/auth", request.url);
  redirectUrl.searchParams.set("next", next);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/billing",
    "/billing/:path*",
    "/admin",
    "/admin/:path*",
    "/editor/:path*",
    "/api/:path*"
  ]
};
