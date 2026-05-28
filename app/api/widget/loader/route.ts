import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getBusinessEntitlementAccess } from "@/lib/server/billing-access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SIROUNDCHAT_DEMO_WIDGET_KEY } from "@/lib/chatbot/siroundchat-demo";

const buildNoopScript = () => "(function(){return;})();";

const buildRuntimeScript = (key: string) =>
  `(function(){var key="${key}";var current=document.currentScript;var origin=(current&&current.src)?new URL(current.src).origin:window.location.origin;var runtime=document.createElement("script");runtime.src=origin+"/widget-runtime/widget.js";runtime.async=true;runtime.dataset.key=key;runtime.dataset.siteId=key;runtime.dataset.baseUrl=origin;document.head.appendChild(runtime);})();`;

const withEtag = (request: Request, script: string, noStore = false) => {
  const etag = createHash("sha1").update(script).digest("hex");

  if (!noStore && request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": noStore ? "no-store" : "public, max-age=3600",
      ...(noStore ? {} : { ETag: etag })
    }
  });
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? searchParams.get("siteId");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient() as any;
  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("widget_key", key)
    .maybeSingle();

  if (!business?.id) {
    return withEtag(request, buildNoopScript());
  }

  // The first-party homepage demo widget always gets the runtime script regardless
  // of subscription state, same as the config route bypass. Never cache it so
  // entitlement changes propagate immediately to siroundchat.com.
  const isDemo = key === SIROUNDCHAT_DEMO_WIDGET_KEY;
  if (isDemo) {
    return withEtag(request, buildRuntimeScript(key), true);
  }

  const access = await getBusinessEntitlementAccess(business.id as string, "chatbot_embed");
  if (!access.allowed) {
    return withEtag(request, buildNoopScript());
  }

  return withEtag(request, buildRuntimeScript(key));
}
