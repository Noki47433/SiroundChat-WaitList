import { createHash } from "crypto";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? searchParams.get("siteId");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const script = `(function(){var key="${key}";var current=document.currentScript;var origin=(current&&current.src)?new URL(current.src).origin:window.location.origin;var runtime=document.createElement("script");runtime.src=origin+"/widget-runtime/widget.js";runtime.async=true;runtime.dataset.key=key;runtime.dataset.siteId=key;runtime.dataset.baseUrl=origin;document.head.appendChild(runtime);})();`;

  const etag = createHash("sha1").update(script).digest("hex");

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
      ETag: etag
    }
  });
}
