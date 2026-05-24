import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  status: z.enum(["bot", "human", "closed"])
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { context, response } = await requireBusinessUser({ entitlement: "unified_inbox" });
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: updated, error } = await (context.supabase as any)
    .from("conversations")
    .update({ status: parsed.data.status })
    .eq("id", params.id)
    .eq("business_id", context.businessId)
    .in("channel_type", ["whatsapp", "instagram"])
    .select("id,status")
    .single();

  if (error || !updated?.id) {
    return NextResponse.json({ error: error?.message ?? "Failed to update conversation status" }, { status: 500 });
  }

  return NextResponse.json({ conversation: updated });
}
