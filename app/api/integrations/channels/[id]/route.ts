import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    auto_reply_enabled: z.boolean().optional(),
    status: z.enum(["connected", "disabled", "needs_reauth"]).optional()
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { context, response } = await requireBusinessUser({ entitlement: "channel_settings" });
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!Object.keys(parsed.data).length) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const { data: updated, error } = await (context.supabase as any)
    .from("business_channels")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("business_id", context.businessId)
    .select(
      "id,business_id,channel_type,provider,status,whatsapp_phone_number_id,whatsapp_business_account_id,instagram_business_account_id,instagram_page_id,display_phone_number,auto_reply_enabled,created_at,updated_at"
    )
    .single();

  if (error || !updated?.id) {
    return NextResponse.json({ error: error?.message ?? "Failed to update channel" }, { status: 500 });
  }

  return NextResponse.json({ channel: updated });
}
