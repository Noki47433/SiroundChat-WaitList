import { NextResponse } from "next/server";
import { userOwnsLaunchedBusiness } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const normalizeUuid = (value: string | null) => (value ?? "").trim().replace(/[<>]/g, "");

export async function GET(request: Request) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const businessId = normalizeUuid(searchParams.get("businessId"));

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const allowed = await userOwnsLaunchedBusiness(user.id, businessId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { count, error: countError } = await supabase
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const { data: chunks, error } = await supabase
    .from("document_chunks")
    .select("chunk_index, content")
    .eq("business_id", businessId)
    .order("chunk_index", { ascending: true })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (chunks ?? []).map((chunk: { chunk_index: number; content: string }) => {
    const text = chunk.content ?? "";
    const lower = text.toLowerCase();
    return {
      chunk_index: chunk.chunk_index,
      chars: text.length,
      preview: text.slice(0, 200),
      hasWhatsApp: lower.includes("whatsapp"),
      hasEmail: lower.includes("email") || text.includes("@"),
      has383: text.includes("+383")
    };
  });

  type RagChunkFlags = {
    hasWhatsApp: boolean;
    hasEmail: boolean;
    has383: boolean;
  };

  const flags = (list as Array<Partial<RagChunkFlags>>).reduce<RagChunkFlags>(
    (acc, chunk) => ({
      hasWhatsApp: acc.hasWhatsApp || Boolean(chunk.hasWhatsApp),
      hasEmail: acc.hasEmail || Boolean(chunk.hasEmail),
      has383: acc.has383 || Boolean(chunk.has383)
    }),
    { hasWhatsApp: false, hasEmail: false, has383: false }
  );

  return NextResponse.json({
    total: count ?? 0,
    ...flags,
    chunks: list
  });
}
