import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { TRACK_EVENT_TYPES, insertAnalyticsEvent } from "@/lib/analytics/events";

const TrackSchema = z.object({
  widget_key: z.string().uuid(),
  type: z.enum(TRACK_EVENT_TYPES),
  session_id: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  conversation_id: z.string().uuid().optional().nullable(),
  message_id: z.string().uuid().optional().nullable()
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = TrackSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { widget_key, type, session_id, url, metadata, conversation_id, message_id } = parsed.data;

  const { data: business, error: bizError } = await (admin as any)
    .from("businesses")
    .select("id")
    .eq("widget_key", widget_key)
    .maybeSingle();

  if (bizError) {
    return NextResponse.json({ error: bizError.message }, { status: 500 });
  }

  if (!business?.id) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  const metadataPayload = {
    ...(metadata ?? {}),
    ...(conversation_id ? { conversation_id } : {}),
    ...(message_id ? { message_id } : {})
  };

  try {
    await insertAnalyticsEvent(admin as any, {
      businessId: business.id,
      siteId: null,
      type,
      sessionId: session_id ?? null,
      url: url ?? null,
      metadata: metadataPayload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to track event";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
