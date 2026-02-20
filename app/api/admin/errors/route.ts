import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "open").trim();
  const severityFilter = (url.searchParams.get("severity") ?? "all").trim();
  const environmentFilter = (url.searchParams.get("environment") ?? "all").trim();
  const businessIdFilter = (url.searchParams.get("business_id") ?? "all").trim();
  const search = (url.searchParams.get("search") ?? "").trim();

  let groupsQuery = (guard.supabase as any).from("error_groups").select("*").order("last_seen_at", { ascending: false }).limit(300);
  if (status !== "all") {
    groupsQuery = groupsQuery.eq("status", status);
  }
  if (search) {
    groupsQuery = groupsQuery.or(`title.ilike.%${search}%,sample_message.ilike.%${search}%`);
  }

  const { data: groups, error } = await groupsQuery;
  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to load error groups." }, { status: 400 });
  }

  const fingerprints = (groups ?? []).map((group: any) => group.fingerprint);
  if (!fingerprints.length) {
    return NextResponse.json({ groups: [], businesses: [] }, { status: 200 });
  }

  const { data: events } = await (guard.supabase as any)
    .from("error_events")
    .select("fingerprint, severity, environment, business_id, created_at")
    .in("fingerprint", fingerprints)
    .order("created_at", { ascending: false })
    .limit(6000);

  const latestByFingerprint = new Map<string, any>();
  const recentCountByFingerprint = new Map<string, number>();
  const businessIds = new Set<string>();
  const last24Ms = Date.now() - 24 * 60 * 60 * 1000;

  for (const event of events ?? []) {
    if (!latestByFingerprint.has(event.fingerprint)) {
      latestByFingerprint.set(event.fingerprint, event);
      if (event.business_id) businessIds.add(event.business_id);
    }

    const stamp = new Date(event.created_at).getTime();
    if (Number.isFinite(stamp) && stamp >= last24Ms) {
      recentCountByFingerprint.set(event.fingerprint, (recentCountByFingerprint.get(event.fingerprint) ?? 0) + 1);
    }
  }

  const { data: businesses } = businessIds.size
    ? await (guard.supabase as any)
        .from("businesses")
        .select("id, name, business_name")
        .in("id", Array.from(businessIds))
    : { data: [] as any[] };

  const businessMap = new Map<string, string>(
    (businesses ?? []).map((business: any) => [business.id, business.name ?? business.business_name ?? "Unknown business"])
  );

  const rows = (groups ?? [])
    .map((group: any) => {
      const latest = latestByFingerprint.get(group.fingerprint);
      return {
        ...group,
        severity: latest?.severity ?? "error",
        environment: latest?.environment ?? "prod",
        business_id: latest?.business_id ?? null,
        business_name: latest?.business_id ? businessMap.get(latest.business_id) ?? null : null,
        recent_24h_count: recentCountByFingerprint.get(group.fingerprint) ?? 0
      };
    })
    .filter((row: any) => (severityFilter === "all" ? true : row.severity === severityFilter))
    .filter((row: any) => (environmentFilter === "all" ? true : row.environment === environmentFilter))
    .filter((row: any) => (businessIdFilter === "all" ? true : row.business_id === businessIdFilter));

  return NextResponse.json(
    {
      groups: rows,
      businesses: Array.from(businessMap.entries()).map(([id, name]) => ({ id, name }))
    },
    { status: 200 }
  );
}

