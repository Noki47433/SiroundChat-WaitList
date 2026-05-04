import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["all", "bot", "human", "closed"]).optional()
});

export async function GET(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let query = (context.supabase as any)
    .from("conversations")
    .select(
      "id,channel_type,customer_display_name,external_customer_id,status,intent,reservation_draft,linked_reservation_id,last_message_preview,last_message_at,metadata,created_at"
    )
    .eq("business_id", context.businessId)
    .eq("channel_type", "whatsapp")
    .order("last_message_at", { ascending: false })
    .limit(200);

  if (parsed.data.status && parsed.data.status !== "all") {
    query = query.eq("status", parsed.data.status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to load conversations" }, { status: 500 });
  }

  const search = parsed.data.q?.trim().toLowerCase();
  const conversations = (data ?? []).filter((row: any) => {
    if (!search) return true;
    const haystack = [
      row.customer_display_name,
      row.external_customer_id,
      row.last_message_preview
    ]
      .filter((value: unknown): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });

  return NextResponse.json({ conversations });
}
