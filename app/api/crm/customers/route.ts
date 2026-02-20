import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { log } from "@/lib/utils/log";

const UpdateSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  preferences: z.record(z.string(), z.any()).optional()
});

const buildReservationMatch = (email?: string | null, phone?: string | null) => {
  if (email && phone) {
    return { filter: `customer_email.eq.${email},customer_phone.eq.${phone}` };
  }
  if (email) {
    return { email };
  }
  if (phone) {
    return { phone };
  }
  return null;
};

export async function GET(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const supabase = context.supabase as any;
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") ?? "").trim();
  const customerId = searchParams.get("customerId");

  try {
    if (customerId) {
      const { data: customer, error } = await supabase
        .from("customers")
        .select("id,name,email,phone,tags,preferences,last_seen_at,created_at")
        .eq("id", customerId)
        .eq("business_id", context.businessId)
        .maybeSingle();

      if (error || !customer?.id) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }

      const reservationMatch = buildReservationMatch(customer.email, customer.phone);
      const reservationQuery = supabase
        .from("reservations")
        .select("id,conversation_id,customer_name,customer_email,customer_phone,datetime,status,notes,created_at")
        .eq("business_id", context.businessId)
        .order("datetime", { ascending: false })
        .limit(100);

      if (reservationMatch?.filter) {
        reservationQuery.or(reservationMatch.filter);
      } else if (reservationMatch?.email) {
        reservationQuery.eq("customer_email", reservationMatch.email);
      } else if (reservationMatch?.phone) {
        reservationQuery.eq("customer_phone", reservationMatch.phone);
      } else {
        reservationQuery.limit(0);
      }

      const [timelineResult, reservationsResult] = await Promise.all([
        supabase
          .from("customer_events")
          .select("id,type,payload,created_at")
          .eq("business_id", context.businessId)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(200),
        reservationQuery
      ]);

      // conversation_feedback query depends on reservations; fetch separately for deterministic behavior.
      const conversationIds = ((reservationsResult.data ?? []) as Array<{ conversation_id?: string | null }>)
        .map((row) => row.conversation_id)
        .filter((value): value is string => Boolean(value));

      const feedbackRows = conversationIds.length
        ? await supabase
            .from("conversation_feedback")
            .select("id,conversation_id,rating,tags,comment,created_at")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false })
            .limit(200)
        : { data: [] as any[], error: null };

      if (timelineResult.error || reservationsResult.error || feedbackRows.error) {
        throw timelineResult.error ?? reservationsResult.error ?? feedbackRows.error;
      }

      return NextResponse.json({
        customer,
        timeline: timelineResult.data ?? [],
        reservations: reservationsResult.data ?? [],
        feedback: feedbackRows.data ?? []
      });
    }

    let query = supabase
      .from("customers")
      .select("id,name,email,phone,tags,preferences,last_seen_at,created_at")
      .eq("business_id", context.businessId)
      .order("last_seen_at", { ascending: false })
      .limit(1000);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ customers: data ?? [] });
  } catch (error) {
    log("error", "Failed to load CRM data", { error, businessId: context.businessId, customerId });
    return NextResponse.json({ error: "Failed to load CRM data" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = context.supabase as any;

  try {
    const { data, error } = await supabase
      .from("customers")
      .update({
        name: parsed.data.name !== undefined ? parsed.data.name : undefined,
        email: parsed.data.email !== undefined ? parsed.data.email : undefined,
        phone: parsed.data.phone !== undefined ? parsed.data.phone : undefined,
        tags: parsed.data.tags !== undefined ? parsed.data.tags : undefined,
        preferences: parsed.data.preferences !== undefined ? parsed.data.preferences : undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", parsed.data.customerId)
      .eq("business_id", context.businessId)
      .select("id,name,email,phone,tags,preferences,last_seen_at,created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ customer: data });
  } catch (error) {
    log("error", "Failed to update customer", { error, businessId: context.businessId, customerId: parsed.data.customerId });
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}
