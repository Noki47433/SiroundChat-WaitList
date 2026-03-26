import { NextResponse } from "next/server";
import { z } from "zod";
import { isPrelaunchUserAllowed } from "@/lib/auth/prelaunch";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/config/auth";
import { getBaseUrl } from "@/lib/utils/base-url";

export async function POST(request: Request) {
  let userId = "";
  if (!isAuthDisabled()) {
    const supabase = getSupabaseRouteClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isPrelaunchUserAllowed(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    userId = user.id;
  }

  const tenant = userId ? await getTenantFromSession(userId) : { userId: "", businessId: "" };
  if (!tenant.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseRouteClient();
  const payload = await request.json().catch(() => null);
  const parsed = z
    .object({
      siteId: z.string().uuid(),
      domain: z.string().min(3)
    })
    .safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const normalizeDomain = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    const noProtocol = trimmed.replace(/^https?:\/\//, "");
    const noPath = noProtocol.split("/")[0];
    const noPort = noPath.split(":")[0];
    return noPort.replace(/\.$/, "");
  };

  const domain = normalizeDomain(parsed.data.domain);
  if (!domain.includes(".") || !/^[a-z0-9.-]+$/.test(domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const { data: site, error: siteError } = await (supabase as any)
    .from("builder_sites")
    .select("id,business_id,slug")
    .eq("id", parsed.data.siteId)
    .eq("business_id", tenant.businessId)
    .maybeSingle();

  if (siteError) {
    return NextResponse.json({ error: "Failed to load site" }, { status: 500 });
  }
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { data: existing } = await (supabase as any)
    .from("builder_domains")
    .select("id,domain,status")
    .eq("site_id", parsed.data.siteId)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateError } = await (supabase as any)
      .from("builder_domains")
      .update({ domain, status: "pending" })
      .eq("id", existing.id);
    if (updateError) {
      return NextResponse.json({ error: "Failed to update domain" }, { status: 500 });
    }
  } else {
    const { error: insertError } = await (supabase as any)
      .from("builder_domains")
      .insert({ site_id: parsed.data.siteId, domain, status: "pending" });
    if (insertError) {
      return NextResponse.json({ error: "Failed to register domain" }, { status: 500 });
    }
  }

  const baseUrl = getBaseUrl(request);
  const host = new URL(baseUrl).host;

  return NextResponse.json({
    status: "pending",
    domain,
    targetHost: host,
    instructions: [
      {
        type: "CNAME",
        name: "www",
        value: host
      },
      {
        type: "A",
        name: "@",
        value: host
      }
    ]
  });
}
