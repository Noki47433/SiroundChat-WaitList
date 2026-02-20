import { NextResponse } from "next/server";

export async function GET(_: Request, context: { params: { siteId: string } }) {
  const embedHtml = `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>SiroundChat Widget</title></head><body style="margin:0;background:transparent;"><div id="root"></div><script>window.location.replace("/embed/${context.params.siteId}");</script></body></html>`;
  return new NextResponse(embedHtml, {
    headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=300" }
  });
}
