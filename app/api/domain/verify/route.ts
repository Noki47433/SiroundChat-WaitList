import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { isAuthDisabled } from "@/lib/config/auth";

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  if (!isAuthDisabled()) {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await userHasLaunchAccess(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const tenant = await getTenantFromSession(user.id);
    if (!tenant.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = z
      .object({
        siteId: z.string().uuid(),
        domain: z.string().optional()
      })
      .safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { data: site } = await (supabase as any)
      .from("builder_sites")
      .select("id")
      .eq("id", parsed.data.siteId)
      .eq("business_id", tenant.businessId)
      .maybeSingle();

    if (!site?.id) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const { data: domainRow } = await (supabase as any)
      .from("builder_domains")
      .select("id,domain,status")
      .eq("site_id", parsed.data.siteId)
      .maybeSingle();

    if (!domainRow) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const { error } = await (supabase as any)
      .from("builder_domains")
      .update({ status: "active" })
      .eq("id", domainRow.id);

    if (error) {
      return NextResponse.json({ error: "Failed to verify domain" }, { status: 500 });
    }

    return NextResponse.json({ status: "active", domain: domainRow.domain });
  }

  const payload = await request.json().catch(() => null);
  const parsed = z
    .object({
      siteId: z.string().uuid(),
      domain: z.string().optional()
    })
    .safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: domainRow } = await (supabase as any)
    .from("builder_domains")
    .select("id,domain,status")
    .eq("site_id", parsed.data.siteId)
    .maybeSingle();

  if (!domainRow) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const { error } = await (supabase as any)
    .from("builder_domains")
    .update({ status: "active" })
    .eq("id", domainRow.id);

  if (error) {
    return NextResponse.json({ error: "Failed to verify domain" }, { status: 500 });
  }

  return NextResponse.json({ status: "active", domain: domainRow.domain });
}
