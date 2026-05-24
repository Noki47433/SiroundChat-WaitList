import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { log } from "@/lib/utils/log";

const BodySchema = z.object({
  channel: z.enum(["whatsapp", "instagram"]),
  externalAccountId: z.string().min(1),
  token: z.string().optional().nullable(),
  status: z.enum(["connected", "disconnected", "pending"]).optional()
});

export async function GET() {
  const { context, response } = await requireBusinessUser({ entitlement: "unified_inbox" });
  if (response) return response;

  const supabase = context.supabase as any;

  try {
    const { data, error } = await supabase
      .from("channel_inboxes")
      .select("id,channel,external_account_id,status,settings,created_at")
      .eq("business_id", context.businessId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ inboxes: data ?? [] });
  } catch (error) {
    log("error", "Failed to load channel inboxes", { error, businessId: context.businessId });
    return NextResponse.json({ error: "Failed to load channels" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { context, response } = await requireBusinessUser({ entitlement: "channel_settings" });
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const requiredEntitlement = parsed.data.channel === "instagram" ? "instagram" : "whatsapp";
  const channelAccess = await getBusinessEntitlementAccess(context.businessId, requiredEntitlement);
  if (!channelAccess.allowed) {
    return buildUpgradeRequiredResponse(requiredEntitlement, channelAccess);
  }

  const supabase = context.supabase as any;

  try {
    const tokenReference = parsed.data.token?.trim() ? parsed.data.token.trim() : null;

    const { data, error } = await supabase
      .from("channel_inboxes")
      .upsert(
        {
          business_id: context.businessId,
          channel: parsed.data.channel,
          external_account_id: parsed.data.externalAccountId,
          access_token_encrypted: tokenReference,
          status: parsed.data.status ?? "connected"
        },
        { onConflict: "business_id,channel" }
      )
      .select("id,channel,external_account_id,status,settings,created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ inbox: data });
  } catch (error) {
    log("error", "Failed to save channel inbox", { error, businessId: context.businessId });
    return NextResponse.json({ error: "Failed to save channel" }, { status: 500 });
  }
}
