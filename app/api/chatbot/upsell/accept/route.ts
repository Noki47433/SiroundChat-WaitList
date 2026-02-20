import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { log } from "@/lib/utils/log";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  offerId: z.string().uuid(),
  customerId: z.string().uuid().optional().nullable(),
  revenueAttributed: z.number().min(0).optional().nullable()
});

export async function POST(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = context.supabase as any;

  try {
    const { data: offerConfig, error: offerConfigError } = await supabase
      .from("upsell_catalog")
      .select("id,name,offer_payload")
      .eq("id", parsed.data.offerId)
      .eq("business_id", context.businessId)
      .maybeSingle();

    if (offerConfigError || !offerConfig?.id) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    const { data: offerRow, error: offerInsertError } = await supabase
      .from("offers")
      .insert({
        business_id: context.businessId,
        customer_id: parsed.data.customerId ?? null,
        conversation_id: parsed.data.conversationId,
        channel: "web_chat",
        offer_type: "upsell",
        offer_payload: {
          upsell_catalog_id: offerConfig.id,
          ...((offerConfig.offer_payload ?? {}) as Record<string, unknown>)
        },
        redeemed_at: new Date().toISOString(),
        revenue_attributed: parsed.data.revenueAttributed ?? 0
      })
      .select("id")
      .single();

    if (offerInsertError || !offerRow?.id) {
      throw offerInsertError ?? new Error("Failed to create offer row");
    }

    await supabase.from("analytics_events").insert({
      business_id: context.businessId,
      conversation_id: parsed.data.conversationId,
      customer_id: parsed.data.customerId ?? null,
      type: "upsell_accepted",
      value_numeric: parsed.data.revenueAttributed ?? 0,
      metadata: {
        offer_id: parsed.data.offerId,
        offer_row_id: offerRow.id
      },
      timestamp: new Date().toISOString()
    });

    if (parsed.data.customerId) {
      await supabase.from("customer_events").insert({
        business_id: context.businessId,
        customer_id: parsed.data.customerId,
        type: "offer_sent",
        payload: {
          type: "upsell",
          offer_id: parsed.data.offerId,
          conversation_id: parsed.data.conversationId
        }
      });
    }

    return NextResponse.json({ success: true, offerRowId: offerRow.id });
  } catch (error) {
    log("error", "Failed to accept upsell", { error, businessId: context.businessId });
    return NextResponse.json({ error: "Failed to accept upsell" }, { status: 500 });
  }
}
