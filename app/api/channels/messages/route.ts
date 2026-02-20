import { NextResponse } from "next/server";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { log } from "@/lib/utils/log";

export async function GET(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const inboxId = searchParams.get("inboxId");
  const customerIdParam = searchParams.get("customerId");
  const filterNullCustomer = customerIdParam === "__null__";
  const customerId = filterNullCustomer ? null : customerIdParam;

  const supabase = context.supabase as any;

  try {
    let query = supabase
      .from("channel_messages")
      .select("id,business_id,inbox_id,external_message_id,customer_id,direction,body,raw,created_at")
      .eq("business_id", context.businessId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (inboxId) query = query.eq("inbox_id", inboxId);
    if (filterNullCustomer) {
      query = query.is("customer_id", null);
    } else if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data: messages, error } = await query;
    if (error) throw error;

    const rows = (messages ?? []) as Array<{
      id: string;
      inbox_id: string;
      customer_id: string | null;
      direction: "in" | "out";
      body: string;
      created_at: string;
      raw?: Record<string, unknown>;
    }>;

    const customerIds = Array.from(new Set(rows.map((row) => row.customer_id).filter((value): value is string => Boolean(value))));

    const customersResult = customerIds.length
      ? await supabase
          .from("customers")
          .select("id,name,email,phone")
          .in("id", customerIds)
      : { data: [] as any[], error: null };

    if (customersResult.error) throw customersResult.error;

    const customerMap = new Map((customersResult.data ?? []).map((row: any) => [row.id, row]));

    if (inboxId && (customerId || filterNullCustomer)) {
      const thread = rows
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((row) => ({
          ...row,
          customer: row.customer_id ? customerMap.get(row.customer_id) ?? null : null
        }));

      return NextResponse.json({ thread });
    }

    const grouped = new Map<string, { key: string; inboxId: string; customerId: string | null; lastMessage: any; count: number }>();

    for (const row of rows) {
      const key = `${row.inbox_id}:${row.customer_id ?? "anonymous"}`;
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, {
          key,
          inboxId: row.inbox_id,
          customerId: row.customer_id,
          lastMessage: row,
          count: 1
        });
      } else {
        current.count += 1;
      }
    }

    const threads = Array.from(grouped.values())
      .sort(
        (a, b) =>
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime()
      )
      .map((entry) => ({
        key: entry.key,
        inboxId: entry.inboxId,
        customerId: entry.customerId,
        customer: entry.customerId ? customerMap.get(entry.customerId) ?? null : null,
        lastMessage: entry.lastMessage,
        count: entry.count
      }));

    return NextResponse.json({ threads });
  } catch (error) {
    log("error", "Failed to load channel messages", {
      error,
      businessId: context.businessId,
      inboxId,
      customerId
    });
    return NextResponse.json({ error: "Failed to load channel messages" }, { status: 500 });
  }
}
