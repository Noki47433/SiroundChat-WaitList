/**
 * The current state of one website: draft spec, publish pointers, and enough
 * version history for an Undo control. Read-only.
 */
import { NextResponse } from "next/server";

import { guardSiteRequest } from "@/lib/site-spec/api/guard";
import { getDraftVersion, getSiteSpecState, listVersions } from "@/lib/site-spec/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const siteId = new URL(request.url).searchParams.get("siteId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) {
    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  }

  const guard = await guardSiteRequest(siteId);
  if (!guard.ok) return guard.response;
  const { context } = guard;

  const [state, draft, history] = await Promise.all([
    getSiteSpecState(context.supabase, context.siteId),
    getDraftVersion(context.supabase, context.siteId),
    listVersions(context.supabase, context.siteId, 25)
  ]);

  if (!state.ok) return NextResponse.json({ error: "Couldn't load that website." }, { status: 500 });

  return NextResponse.json({
    state: state.value,
    slug: context.slug,
    spec: draft.ok ? (draft.value?.spec ?? null) : null,
    specReadable: draft.ok,
    versions: history.ok
      ? history.value.versions.map((version) => ({
          id: version.id,
          number: version.versionNumber,
          label: version.label,
          source: version.source,
          parentVersionId: version.parentVersionId,
          createdAt: version.createdAt
        }))
      : []
  });
}
