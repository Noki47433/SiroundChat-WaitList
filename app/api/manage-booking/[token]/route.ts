import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { hashManageToken, looksLikeManageToken } from "@/lib/booking/manage-token";
import { resolveWorkerDaySlots } from "@/lib/booking/availability-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Phase 2 · Stage 4 · S11 — public no-account manage-booking endpoint (DORMANT).
 *
 * Authorized solely by the token in the path (hashed here; only the hash ever
 * touches the DB). Rate-limited per token+IP. Reveals only the single booking's
 * safe fields; no cross-booking access. Reschedule is re-validated against the
 * live neutral availability engine before the atomic, snapshot-preserving move.
 * The raw token is never persisted or logged.
 */
const clientIp = (request: Request): string =>
  (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

async function limited(kind: string, token: string, request: Request): Promise<boolean> {
  const r = await checkRateLimit({
    key: `manage-booking:${kind}:${hashManageToken(token)}:${clientIp(request)}`,
    limit: kind === "mutate" ? 10 : 30,
    windowInSeconds: 60
  });
  return !r.allowed;
}

// Safe, uniform "no" — never distinguishes "bad token" from "revoked" to a probe.
const safeNotFound = () => NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });

// Phase 3 UI: build a full, safe WidgetTheme for the manage page from the
// business's real brand colours. Presentation only — no auth/booking effect.
type ManageTheme = { primary: string; accent: string; secondary: string; background: string; text: string; shape: "rounded" | "pill" | "square" };
const MANAGE_THEME_DEFAULT: ManageTheme = { primary: "#C9A227", accent: "#C9A227", secondary: "#17171C", background: "#07070A", text: "#F2F2F5", shape: "rounded" };

const isHex = (v: unknown): v is string => typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v.trim());
const relLum = (hex: string): number => {
  const h = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.2154 * ch[2];
};
/**
 * Pick the vivid brand accent: businesses store a near-black chassis colour +
 * a lighter brand accent (gold/rose/pink/amber). The accent is the lighter
 * (higher relative luminance) of the two; the manage page derives a WCAG-safe
 * text/fill accent from it. Falls back to the default gold if colours are absent.
 */
function buildManageThemeFromBrand(primaryColor: unknown, secondaryColor: unknown): ManageTheme {
  const p = isHex(primaryColor) ? (primaryColor as string) : null;
  const s = isHex(secondaryColor) ? (secondaryColor as string) : null;
  if (!p && !s) return MANAGE_THEME_DEFAULT;
  const both = [p, s].filter(Boolean) as string[];
  const accent = both.length === 2 ? (relLum(both[0]) >= relLum(both[1]) ? both[0] : both[1]) : both[0];
  const dark = both.length === 2 ? (accent === both[0] ? both[1] : both[0]) : MANAGE_THEME_DEFAULT.secondary;
  return { primary: accent, accent, secondary: dark, background: MANAGE_THEME_DEFAULT.background, text: MANAGE_THEME_DEFAULT.text, shape: "rounded" };
}

export async function GET(request: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!looksLikeManageToken(token)) return safeNotFound();
  if (await limited("lookup", token, request)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const admin = getSupabaseAdminClient() as any;
  const { data } = await admin.rpc("manage_booking", {
    p_token_hash: hashManageToken(token),
    p_action: "lookup"
  });
  if (!data?.ok) return safeNotFound();
  const b = data.booking;

  // Additive, read-only surface of already-existing display data — business
  // branding/theme, assigned worker, location/address. No booking-logic change.
  const [bizRes, workerRes, locRes, siteRes] = await Promise.all([
    admin.from("businesses").select("business_name, name, logo_url").eq("id", b.business_id).maybeSingle(),
    b.team_member_id
      ? admin.from("team_member").select("display_name").eq("id", b.team_member_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("location").select("name, address, timezone").eq("id", b.location_id).maybeSingle(),
    // Real brand colours live on the business's published website row.
    admin.from("builder_sites").select("primary_color, secondary_color, status").eq("business_id", b.business_id)
  ]);
  const biz = (bizRes.data ?? null) as { business_name?: string | null; name?: string | null; logo_url?: string | null } | null;
  const sites = (Array.isArray(siteRes.data) ? siteRes.data : []) as Array<{ primary_color?: string | null; secondary_color?: string | null; status?: string | null }>;
  const site = sites.find((s) => s.status === "published") ?? sites[0] ?? null;
  const theme = buildManageThemeFromBrand(site?.primary_color, site?.secondary_color);
  const loc = (locRes.data ?? null) as { name?: string | null; address?: string | null; timezone?: string | null } | null;
  const worker = (workerRes.data ?? null) as { display_name?: string | null } | null;
  const tz = loc?.timezone ?? "UTC";

  // Offer reschedule options for the same worker over the next 14 days.
  let slots: Array<{ startAtIso: string; date: string; label: string }> = [];
  if (b.manageable) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const now = new Date();
    for (let i = 0; i < 14 && slots.length < 30; i++) {
      const d = new Date(now.getTime() + i * 86400_000).toISOString().slice(0, 10);
      const day = await resolveWorkerDaySlots(admin, {
        businessId: b.business_id,
        locationId: b.location_id,
        teamMemberId: b.team_member_id,
        serviceId: b.service_id,
        dateISO: d,
        now
      });
      slots = slots.concat(day.map((s) => ({ startAtIso: s.startAtIso, date: d, label: fmt.format(new Date(s.startAtIso)) })));
    }
  }

  return NextResponse.json({
    booking: {
      status: b.status,
      serviceName: b.service_name,
      customerName: b.customer_name,
      startAt: b.start_at,
      endAt: b.end_at,
      durationMin: b.duration_min,
      manageable: b.manageable,
      business: {
        name: biz?.business_name || biz?.name || null,
        logoUrl: biz?.logo_url || null,
        theme
      },
      worker: { name: worker?.display_name ?? null },
      location: { name: loc?.name ?? null, address: loc?.address ?? null, timezone: tz }
    },
    rescheduleSlots: slots.slice(0, 30)
  });
}

const BodySchema = z.union([
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("reschedule"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    newStart: z.string().datetime({ offset: true })
  })
]);

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!looksLikeManageToken(token)) return safeNotFound();
  if (await limited("mutate", token, request)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const admin = getSupabaseAdminClient() as any;
  const tokenHash = hashManageToken(token);

  if (parsed.data.action === "cancel") {
    const { data } = await admin.rpc("manage_booking", { p_token_hash: tokenHash, p_action: "cancel" });
    if (!data?.ok) return mapManageError(data);
    return NextResponse.json({ ok: true, action: "cancel" });
  }

  // reschedule: re-validate the requested slot against the live engine first.
  const { data: look } = await admin.rpc("manage_booking", { p_token_hash: tokenHash, p_action: "lookup" });
  if (!look?.ok) return safeNotFound();
  const b = look.booking;
  if (!b.manageable) return NextResponse.json({ error: "This booking can no longer be changed." }, { status: 409 });

  const requestedInstant = new Date(parsed.data.newStart).getTime();
  const slots = await resolveWorkerDaySlots(admin, {
    businessId: b.business_id,
    locationId: b.location_id,
    teamMemberId: b.team_member_id,
    serviceId: b.service_id,
    dateISO: parsed.data.date,
    now: new Date()
  });
  if (!slots.some((s) => new Date(s.startAtIso).getTime() === requestedInstant)) {
    return NextResponse.json({ error: "That time is not available." }, { status: 409 });
  }

  const { data } = await admin.rpc("manage_booking", {
    p_token_hash: tokenHash,
    p_action: "reschedule",
    p_new_start: parsed.data.newStart
  });
  if (!data?.ok) return mapManageError(data);
  return NextResponse.json({ ok: true, action: "reschedule", startAt: data.start_at, endAt: data.end_at });
}

function mapManageError(data: any) {
  const err = data?.error;
  if (err === "window_closed") {
    return NextResponse.json({ error: "It is too close to the appointment to change it online." }, { status: 409 });
  }
  if (err === "slot_unavailable") {
    return NextResponse.json({ error: "That time was just taken." }, { status: 409 });
  }
  if (err === "not_manageable") {
    return NextResponse.json({ error: "This booking can no longer be changed." }, { status: 409 });
  }
  return safeNotFound();
}
