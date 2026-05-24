import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/server/business-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { context, response } = await requireBusinessUser({ entitlement: "channel_settings" });
  if (response) return response;

  const [{ data: channels, error: channelError }, { data: business, error: businessError }] = await Promise.all([
    (context.supabase as any)
      .from("business_channels")
      .select(
        "id,business_id,channel_type,provider,status,whatsapp_phone_number_id,whatsapp_business_account_id,instagram_business_account_id,instagram_page_id,display_phone_number,auto_reply_enabled,created_at,updated_at"
      )
      .eq("business_id", context.businessId)
      .order("created_at", { ascending: false }),
    (context.supabase as any)
      .from("businesses")
      .select("widget_key")
      .eq("id", context.businessId)
      .maybeSingle()
  ]);

  if (channelError) {
    return NextResponse.json({ error: channelError.message }, { status: 500 });
  }

  if (businessError) {
    return NextResponse.json({ error: businessError.message }, { status: 500 });
  }

  return NextResponse.json({
    channels: channels ?? [],
    websiteChatConnected: typeof business?.widget_key === "string" && business.widget_key.trim().length > 0
  });
}
