import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { log } from "@/lib/utils/log";

const MergeSchema = z.object({
  primaryCustomerId: z.string().uuid(),
  secondaryCustomerId: z.string().uuid()
});

export async function POST(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = MergeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { primaryCustomerId, secondaryCustomerId } = parsed.data;
  if (primaryCustomerId === secondaryCustomerId) {
    return NextResponse.json({ error: "Primary and secondary customer must be different" }, { status: 400 });
  }

  const supabase = context.supabase as any;

  try {
    const { data: customers, error: customerError } = await supabase
      .from("customers")
      .select("id,business_id,name,email,phone,tags,preferences")
      .eq("business_id", context.businessId)
      .in("id", [primaryCustomerId, secondaryCustomerId]);

    if (customerError) throw customerError;

    const primary = (customers ?? []).find((row: any) => row.id === primaryCustomerId);
    const secondary = (customers ?? []).find((row: any) => row.id === secondaryCustomerId);

    if (!primary || !secondary) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const mergedTags = Array.from(new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])]));
    const mergedPreferences = {
      ...(secondary.preferences ?? {}),
      ...(primary.preferences ?? {})
    };

    const mergedUpdate = {
      name: primary.name ?? secondary.name,
      email: primary.email ?? secondary.email,
      phone: primary.phone ?? secondary.phone,
      tags: mergedTags,
      preferences: mergedPreferences,
      updated_at: new Date().toISOString()
    };

    await Promise.all([
      supabase.from("customer_events").update({ customer_id: primaryCustomerId }).eq("customer_id", secondaryCustomerId),
      supabase.from("lead_qualifications").update({ customer_id: primaryCustomerId }).eq("customer_id", secondaryCustomerId),
      supabase.from("offers").update({ customer_id: primaryCustomerId }).eq("customer_id", secondaryCustomerId),
      supabase.from("channel_messages").update({ customer_id: primaryCustomerId }).eq("customer_id", secondaryCustomerId),
      supabase.from("outbox_messages").update({ customer_id: primaryCustomerId }).eq("customer_id", secondaryCustomerId),
      supabase.from("analytics_events").update({ customer_id: primaryCustomerId }).eq("customer_id", secondaryCustomerId)
    ]);

    const { data: mergedCustomer, error: updateError } = await supabase
      .from("customers")
      .update(mergedUpdate)
      .eq("id", primaryCustomerId)
      .eq("business_id", context.businessId)
      .select("id,name,email,phone,tags,preferences,last_seen_at,created_at")
      .single();

    if (updateError) throw updateError;

    const { error: deleteError } = await supabase
      .from("customers")
      .delete()
      .eq("id", secondaryCustomerId)
      .eq("business_id", context.businessId);

    if (deleteError) throw deleteError;

    await supabase.from("customer_events").insert({
      business_id: context.businessId,
      customer_id: primaryCustomerId,
      type: "customer_merged",
      payload: {
        from_customer_id: secondaryCustomerId
      }
    });

    return NextResponse.json({ success: true, customer: mergedCustomer });
  } catch (error) {
    log("error", "Failed to merge customers", {
      error,
      businessId: context.businessId,
      primaryCustomerId,
      secondaryCustomerId
    });
    return NextResponse.json({ error: "Failed to merge customers" }, { status: 500 });
  }
}
