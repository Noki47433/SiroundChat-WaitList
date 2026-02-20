import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { ANNOUNCEMENT_PRESETS, DEFAULT_ANNOUNCEMENT_EMOJI, type AnnouncementPresetKey } from "@/lib/announcements/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = ["draft", "scheduled", "published", "archived"] as const;
const VALID_AUDIENCES = ["all", "business"] as const;
const VALID_PRESETS = Object.keys(ANNOUNCEMENT_PRESETS) as AnnouncementPresetKey[];

const normalizeTimestamp = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const normalizeEmoji = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return DEFAULT_ANNOUNCEMENT_EMOJI;
  return trimmed.slice(0, 2);
};

export async function GET(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "all").trim();
  const audience = (url.searchParams.get("audience") ?? "all").trim();
  const businessId = (url.searchParams.get("business_id") ?? "").trim();
  const search = (url.searchParams.get("search") ?? "").trim();

  let query = (guard.supabase as any)
    .from("announcements")
    .select("*")
    .order("starts_at", { ascending: false })
    .limit(200);

  if (status !== "all" && VALID_STATUSES.includes(status as any)) {
    query = query.eq("status", status);
  }
  if (audience !== "all" && VALID_AUDIENCES.includes(audience as any)) {
    query = query.eq("audience", audience);
  }
  if (businessId) {
    query = query.eq("business_id", businessId);
  }
  if (search) {
    query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
  }

  const [rowsResult, businessesResult] = await Promise.all([
    query,
    (guard.supabase as any)
      .from("businesses")
      .select("id, name, business_name")
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  if (rowsResult.error) {
    return NextResponse.json({ error: rowsResult.error.message ?? "Failed to load announcements." }, { status: 400 });
  }

  return NextResponse.json(
    {
      announcements: rowsResult.data ?? [],
      businesses: (businessesResult.data ?? []).map((business: any) => ({
        id: business.id,
        name: business.name ?? business.business_name ?? "Unknown business"
      }))
    },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as {
    status?: string;
    audience?: string;
    business_id?: string | null;
    emoji?: string;
    preset?: AnnouncementPresetKey;
    title?: string;
    body?: string;
    cta_label?: string | null;
    cta_url?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    is_dismissible?: boolean;
  } | null;

  const status = (body?.status ?? "draft").trim();
  const audience = (body?.audience ?? "all").trim();
  const preset = ((body?.preset ?? "custom").trim() as AnnouncementPresetKey) || "custom";
  const template = ANNOUNCEMENT_PRESETS[preset] ?? ANNOUNCEMENT_PRESETS.custom;
  const title = (body?.title ?? template.title).trim();
  const textBody = (body?.body ?? template.body).trim();

  if (!VALID_STATUSES.includes(status as any)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (!VALID_AUDIENCES.includes(audience as any)) {
    return NextResponse.json({ error: "Invalid audience." }, { status: 400 });
  }
  if (audience === "business" && !body?.business_id) {
    return NextResponse.json({ error: "business_id is required for business audience." }, { status: 400 });
  }
  if (title.length < 4 || title.length > 120) {
    return NextResponse.json({ error: "Title must be between 4 and 120 characters." }, { status: 400 });
  }
  if (textBody.length < 10 || textBody.length > 4000) {
    return NextResponse.json({ error: "Body must be between 10 and 4000 characters." }, { status: 400 });
  }

  const startsAt = normalizeTimestamp(body?.starts_at ?? null) ?? new Date().toISOString();
  const endsAt = normalizeTimestamp(body?.ends_at ?? null);
  if (endsAt && +new Date(endsAt) < +new Date(startsAt)) {
    return NextResponse.json({ error: "ends_at must be later than starts_at." }, { status: 400 });
  }

  const { data, error } = await (guard.supabase as any)
    .from("announcements")
    .insert({
      status,
      audience,
      business_id: audience === "business" ? body?.business_id ?? null : null,
      emoji: normalizeEmoji(body?.emoji ?? template.emoji),
      preset: VALID_PRESETS.includes(preset) ? preset : "custom",
      title,
      body: textBody,
      cta_label: body?.cta_label?.trim() || null,
      cta_url: body?.cta_url?.trim() || null,
      starts_at: startsAt,
      ends_at: endsAt,
      is_dismissible: body?.is_dismissible ?? true,
      created_by: guard.userId
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to create announcement." }, { status: 400 });
  }

  return NextResponse.json({ announcement: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: string;
    audience?: string;
    business_id?: string | null;
    emoji?: string;
    preset?: AnnouncementPresetKey;
    title?: string;
    body?: string;
    cta_label?: string | null;
    cta_url?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    is_dismissible?: boolean;
  } | null;

  const id = body?.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body?.status === "string") {
    const value = body.status.trim();
    if (!VALID_STATUSES.includes(value as any)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    patch.status = value;
  }
  if (typeof body?.audience === "string") {
    const value = body.audience.trim();
    if (!VALID_AUDIENCES.includes(value as any)) {
      return NextResponse.json({ error: "Invalid audience." }, { status: 400 });
    }
    patch.audience = value;
    if (value === "all") {
      patch.business_id = null;
    } else if (value === "business") {
      if (!body.business_id) {
        return NextResponse.json({ error: "business_id is required for business audience." }, { status: 400 });
      }
      patch.business_id = body.business_id;
    }
  } else if (typeof body?.business_id !== "undefined") {
    patch.business_id = body.business_id;
  }
  if (typeof body?.emoji === "string") patch.emoji = normalizeEmoji(body.emoji);
  if (typeof body?.preset === "string") {
    const preset = body.preset.trim() as AnnouncementPresetKey;
    patch.preset = VALID_PRESETS.includes(preset) ? preset : "custom";
  }
  if (typeof body?.title === "string") {
    const value = body.title.trim();
    if (value.length < 4 || value.length > 120) {
      return NextResponse.json({ error: "Title must be between 4 and 120 characters." }, { status: 400 });
    }
    patch.title = value;
  }
  if (typeof body?.body === "string") {
    const value = body.body.trim();
    if (value.length < 10 || value.length > 4000) {
      return NextResponse.json({ error: "Body must be between 10 and 4000 characters." }, { status: 400 });
    }
    patch.body = value;
  }
  if (typeof body?.cta_label !== "undefined") patch.cta_label = body.cta_label?.trim() || null;
  if (typeof body?.cta_url !== "undefined") patch.cta_url = body.cta_url?.trim() || null;
  if (typeof body?.is_dismissible === "boolean") patch.is_dismissible = body.is_dismissible;
  if (typeof body?.starts_at !== "undefined") {
    const value = normalizeTimestamp(body.starts_at);
    if (!value) return NextResponse.json({ error: "Invalid starts_at." }, { status: 400 });
    patch.starts_at = value;
  }
  if (typeof body?.ends_at !== "undefined") {
    if (body.ends_at === null || body.ends_at === "") {
      patch.ends_at = null;
    } else {
      const value = normalizeTimestamp(body.ends_at);
      if (!value) return NextResponse.json({ error: "Invalid ends_at." }, { status: 400 });
      patch.ends_at = value;
    }
  }

  const { data, error } = await (guard.supabase as any)
    .from("announcements")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to update announcement." }, { status: 400 });
  }

  return NextResponse.json({ announcement: data }, { status: 200 });
}

