import { NextResponse } from "next/server";

// P0 SEC-3: this route previously interpolated the raw `siteId` path param into an inline
// <script> served as text/html on the app origin — a reflected XSS. It now (1) strictly
// validates the id as a UUID and (2) performs a server-side redirect to the rendered embed
// page, so no attacker-controlled value ever reaches an executable/HTML context.
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function GET(request: Request, context: { params: { siteId: string } }) {
  const siteId = context.params.siteId;
  if (!UUID_RE.test(siteId)) {
    // Inert response for malformed ids — no reflection of the input.
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  // siteId is a validated UUID, so it is safe to place in the URL path.
  const target = new URL(`/embed/${siteId}`, request.url);
  return NextResponse.redirect(target, {
    status: 307,
    headers: { "Cache-Control": "public, max-age=300" }
  });
}
