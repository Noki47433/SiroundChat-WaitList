/**
 * Phase 3 · Client Website — Site Spec persistence.
 *
 * The state model, in one paragraph:
 *
 *   A site has an append-only list of **versions**, each holding one validated
 *   Site Spec. `draft_version_id` points at the version being worked on;
 *   `published_version_id` points at the one customers are served. Saving an
 *   edit appends a version and moves the draft pointer. Publishing moves the
 *   published pointer onto an existing version — it writes no content, so the
 *   live site cannot be half-updated. Undo copies an older version forward as a
 *   new one, so undoing is itself undoable and no model is ever asked to
 *   reverse its own edit.
 *
 * Every spec is validated on the way in AND on the way out. Validating on read
 * matters because a version written under an older schema must not silently
 * render as something the current renderer does not understand.
 *
 * Follows `lib/business/load.ts`: a structural client type rather than a
 * `server-only` import, so this layer is exercisable without a live database.
 */
import { parseSiteSpec, validateSiteSpec, type SiteSpec } from "@/lib/site-spec/schema";
import { logSiteSpecFailure } from "@/lib/site-spec/telemetry";

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => any;
};

export const VERSION_SOURCES = ["generated", "edit", "restore", "import", "manual"] as const;
export type VersionSource = (typeof VERSION_SOURCES)[number];

export type SiteVersion = {
  id: string;
  siteId: string;
  businessId: string;
  versionNumber: number;
  spec: SiteSpec;
  source: VersionSource;
  label: string | null;
  parentVersionId: string | null;
  restoredFromVersionId: string | null;
  createdAt: string;
};

/** A version row whose spec did not survive validation. Listed, never rendered. */
export type UnreadableVersion = {
  id: string;
  versionNumber: number;
  createdAt: string;
  issues: Array<{ path: string; message: string }>;
};

export type SiteSpecState = {
  siteId: string;
  businessId: string;
  slug: string | null;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  publishedAt: string | null;
  /** True when the draft has moved on from what customers are served. */
  hasUnpublishedChanges: boolean;
};

export type StoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "invalid_spec"; issues: Array<{ path: string; message: string }> }
  | { ok: false; reason: "not_found" | "db_error" | "conflict"; message: string };

const messageOf = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : String(error);

/**
 * `PT409` is how `builder_site_create_version` reports that the draft moved
 * between the caller's read and its write. It is a conflict, not a database
 * fault, and the difference matters all the way up: one gets the owner a
 * "someone else changed this" answer, the other gets them a 500.
 *
 * `PT409` rather than the semantically-obvious `serialization_failure` (40001)
 * for a reason found by running this against real PostgREST: PostgREST treats
 * class-40 as a transient failure and RETRIES the request, so the conflict came
 * back as a 504 gateway timeout several seconds later. `PTxxx` is PostgREST's
 * explicit "answer with this HTTP status" convention. 40001 is still recognised
 * here so a database that raises it directly is not misread as a fault.
 */
const isStaleDraft = (error: unknown): boolean => {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : null;
  if (code === "PT409" || code === "40001") return true;
  return /draft moved/i.test(messageOf(error));
};

const dbError = (error: unknown): StoreResult<never> =>
  isStaleDraft(error)
    ? { ok: false, reason: "conflict", message: "the draft moved before this change could be saved" }
    : { ok: false, reason: "db_error", message: messageOf(error) };

// ─────────────────────────────────────────────────────────────────────────────
// Row mapping
// ─────────────────────────────────────────────────────────────────────────────

const VERSION_COLUMNS =
  "id, site_id, business_id, version_number, spec, source, label, parent_version_id, restored_from_version_id, created_at";

const toVersion = (row: any): SiteVersion | null => {
  const spec = parseSiteSpec(row?.spec);
  if (!spec) return null;
  return {
    id: row.id,
    siteId: row.site_id,
    businessId: row.business_id,
    versionNumber: row.version_number,
    spec,
    source: row.source,
    label: row.label ?? null,
    parentVersionId: row.parent_version_id ?? null,
    restoredFromVersionId: row.restored_from_version_id ?? null,
    createdAt: row.created_at
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export const getSiteSpecState = async (
  supabase: SupabaseLike,
  siteId: string
): Promise<StoreResult<SiteSpecState>> => {
  const { data, error } = await supabase
    .from("builder_sites")
    .select("id, business_id, slug, draft_version_id, published_version_id, spec_published_at")
    .eq("id", siteId)
    .maybeSingle();

  if (error) return dbError(error);
  if (!data) return { ok: false, reason: "not_found", message: `site ${siteId} not found` };

  return {
    ok: true,
    value: {
      siteId: data.id,
      businessId: data.business_id,
      slug: data.slug ?? null,
      draftVersionId: data.draft_version_id ?? null,
      publishedVersionId: data.published_version_id ?? null,
      publishedAt: data.spec_published_at ?? null,
      hasUnpublishedChanges:
        Boolean(data.draft_version_id) && data.draft_version_id !== data.published_version_id
    }
  };
};

const getVersionById = async (
  supabase: SupabaseLike,
  versionId: string
): Promise<StoreResult<SiteVersion>> => {
  const { data, error } = await supabase
    .from("builder_site_versions")
    .select(VERSION_COLUMNS)
    .eq("id", versionId)
    .maybeSingle();

  if (error) return dbError(error);
  if (!data) return { ok: false, reason: "not_found", message: `version ${versionId} not found` };

  const version = toVersion(data);
  if (!version) {
    const result = validateSiteSpec(data.spec);
    return {
      ok: false,
      reason: "invalid_spec",
      issues: result.ok ? [] : result.issues
    };
  }
  return { ok: true, value: version };
};

/** The spec the owner is working on. */
export const getDraftVersion = async (
  supabase: SupabaseLike,
  siteId: string
): Promise<StoreResult<SiteVersion | null>> => {
  const state = await getSiteSpecState(supabase, siteId);
  if (!state.ok) return state;
  if (!state.value.draftVersionId) return { ok: true, value: null };
  return getVersionById(supabase, state.value.draftVersionId);
};

/** The spec customers are served. Unaffected by draft edits. */
export const getPublishedVersion = async (
  supabase: SupabaseLike,
  siteId: string
): Promise<StoreResult<SiteVersion | null>> => {
  const state = await getSiteSpecState(supabase, siteId);
  if (!state.ok) return state;
  if (!state.value.publishedVersionId) return { ok: true, value: null };
  return getVersionById(supabase, state.value.publishedVersionId);
};

export const listVersions = async (
  supabase: SupabaseLike,
  siteId: string,
  limit = 50
): Promise<StoreResult<{ versions: SiteVersion[]; unreadable: UnreadableVersion[] }>> => {
  const { data, error } = await supabase
    .from("builder_site_versions")
    .select(VERSION_COLUMNS)
    .eq("site_id", siteId)
    .order("version_number", { ascending: false })
    .limit(limit);

  if (error) return dbError(error);

  const versions: SiteVersion[] = [];
  const unreadable: UnreadableVersion[] = [];
  for (const row of (data ?? []) as any[]) {
    const version = toVersion(row);
    if (version) {
      versions.push(version);
      continue;
    }
    // Surfaced rather than dropped: an owner should be able to see that a point
    // in their history exists even when this build can no longer read it.
    const result = validateSiteSpec(row.spec);
    unreadable.push({
      id: row.id,
      versionNumber: row.version_number,
      createdAt: row.created_at,
      issues: result.ok ? [] : result.issues
    });
  }

  return { ok: true, value: { versions, unreadable } };
};

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append a version and point the draft at it. The published site is untouched.
 *
 * An invalid spec is rejected here and never reaches the database, which is why
 * the renderer downstream can assume what it is handed is coherent.
 *
 * `expectedParentVersionId` is the caller's claim about which draft it edited.
 * Supplying it makes the append a compare-and-swap: if another session got there
 * first, this returns `conflict` and writes nothing. Omitting it means "I am not
 * making a claim" — correct for a first generation, which has no parent to
 * claim, and wrong for an edit, which always has one.
 */
export const saveDraftSpec = async (
  supabase: SupabaseLike,
  siteId: string,
  spec: unknown,
  options: {
    source?: VersionSource;
    label?: string | null;
    expectedParentVersionId?: string | null;
  } = {}
): Promise<StoreResult<SiteVersion>> => {
  const validation = validateSiteSpec(spec);
  if (!validation.ok) return { ok: false, reason: "invalid_spec", issues: validation.issues };

  const { data, error } = await supabase.rpc("builder_site_create_version", {
    p_site_id: siteId,
    p_spec: validation.spec,
    p_source: options.source ?? "edit",
    p_label: options.label ?? null,
    p_restored_from: null,
    p_expected_parent: options.expectedParentVersionId ?? null
  });

  if (error) return dbError(error);
  const row = Array.isArray(data) ? data[0] : data;
  const version = toVersion(row);
  if (!version) {
    return { ok: false, reason: "db_error", message: "version was written but could not be read back" };
  }
  return { ok: true, value: version };
};

/**
 * Promote a version to live.
 *
 * Re-validates before moving the pointer: a version written under an earlier
 * schema must not become the published page just because it was once accepted.
 */
export const publishSite = async (
  supabase: SupabaseLike,
  siteId: string,
  versionId?: string
): Promise<StoreResult<{ publishedVersion: SiteVersion; publishedAt: string | null }>> => {
  const state = await getSiteSpecState(supabase, siteId);
  if (!state.ok) return state;

  const target = versionId ?? state.value.draftVersionId;
  if (!target) {
    return { ok: false, reason: "not_found", message: "this site has no draft to publish" };
  }

  const version = await getVersionById(supabase, target);
  if (!version.ok) return version;
  if (version.value.siteId !== siteId) {
    return { ok: false, reason: "not_found", message: "that version belongs to a different site" };
  }

  const { data, error } = await supabase.rpc("builder_site_publish", {
    p_site_id: siteId,
    p_version_id: target
  });
  if (error) return dbError(error);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    value: { publishedVersion: version.value, publishedAt: row?.spec_published_at ?? null }
  };
};

export const unpublishSite = async (
  supabase: SupabaseLike,
  siteId: string
): Promise<StoreResult<true>> => {
  const { error } = await supabase.rpc("builder_site_unpublish", { p_site_id: siteId });
  if (error) return dbError(error);
  return { ok: true, value: true };
};

/**
 * Undo — deterministically, by copying an older version's spec forward.
 *
 * Nothing is rewritten and nothing is asked to reason about the change. The
 * restored state is byte-identical to the version being restored.
 */
export const restoreVersion = async (
  supabase: SupabaseLike,
  siteId: string,
  versionId: string
): Promise<StoreResult<SiteVersion>> => {
  const source = await getVersionById(supabase, versionId);
  if (!source.ok) return source;
  if (source.value.siteId !== siteId) {
    return { ok: false, reason: "not_found", message: "that version belongs to a different site" };
  }

  const { data, error } = await supabase.rpc("builder_site_restore_version", {
    p_site_id: siteId,
    p_version_id: versionId
  });
  if (error) return dbError(error);

  const row = Array.isArray(data) ? data[0] : data;
  const version = toVersion(row);
  if (!version) {
    return { ok: false, reason: "db_error", message: "restore was written but could not be read back" };
  }
  return { ok: true, value: version };
};

/**
 * Undo one step.
 *
 * The subtlety is what "one step" means after a previous undo. A restore appends
 * a new version whose parent is the version it replaced, so naively following
 * `parentVersionId` twice walks *forward* again — undo, redo, undo, redo. It has
 * to step back from what the draft is a copy OF, not from where it sits in the
 * append order.
 *
 *   v1 → v2 → v3            draft = v3
 *   undo  → v4 (copy of v2, parent v3)
 *   undo  → v5 (copy of v1)   ← not "a copy of v3"
 */
export const undoLastChange = async (
  supabase: SupabaseLike,
  siteId: string
): Promise<StoreResult<SiteVersion>> => {
  const draft = await getDraftVersion(supabase, siteId);
  if (!draft.ok) return draft;
  if (!draft.value) {
    return { ok: false, reason: "not_found", message: "there is nothing earlier to go back to" };
  }

  // If the draft is itself a restore, step back from its ORIGINAL position.
  let anchor = draft.value;
  if (anchor.source === "restore" && anchor.restoredFromVersionId) {
    const source = await getVersionById(supabase, anchor.restoredFromVersionId);
    if (source.ok) anchor = source.value;
  }

  if (!anchor.parentVersionId) {
    return { ok: false, reason: "not_found", message: "there is nothing earlier to go back to" };
  }
  return restoreVersion(supabase, siteId, anchor.parentVersionId);
};

// ─────────────────────────────────────────────────────────────────────────────
// Public read path
// ─────────────────────────────────────────────────────────────────────────────

export type PublishedSiteSpec = {
  siteId: string;
  businessId: string;
  slug: string;
  versionId: string;
  versionNumber: number;
  spec: SiteSpec;
};

/**
 * What `app/s/[slug]` serves. Returns null — never a partial render — when the
 * site is not on the Site Spec model, so the legacy document paths stay
 * untouched for every site that has not been migrated.
 */
export const loadPublishedSpecBySlug = async (
  supabase: SupabaseLike,
  slug: string
): Promise<PublishedSiteSpec | null> => {
  const { data: site } = await supabase
    .from("builder_sites")
    .select("id, business_id, slug, published_version_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!site?.published_version_id) return null;

  const { data: row } = await supabase
    .from("builder_site_versions")
    .select(VERSION_COLUMNS)
    .eq("id", site.published_version_id)
    .maybeSingle();

  const version = row ? toVersion(row) : null;
  if (!version) {
    // A published pointer that no longer parses. Returning null makes the public
    // route fall back to the legacy document path, which is the safe outcome —
    // but it is also silent, and a canary needs to know it happened.
    logSiteSpecFailure("RENDER_FAILED", {
      siteId: site.id,
      businessId: site.business_id,
      surface: "published",
      reason: row ? "unreadable_spec" : "version_missing"
    });
    return null;
  }

  return {
    siteId: site.id,
    businessId: site.business_id,
    slug: site.slug,
    versionId: version.id,
    versionNumber: version.versionNumber,
    spec: version.spec
  };
};

/** The preview equivalent: the owner's current draft, published or not. */
export const loadDraftSpecBySiteId = async (
  supabase: SupabaseLike,
  siteId: string
): Promise<PublishedSiteSpec | null> => {
  const { data: site } = await supabase
    .from("builder_sites")
    .select("id, business_id, slug, draft_version_id")
    .eq("id", siteId)
    .maybeSingle();

  if (!site?.draft_version_id) return null;

  const { data: row } = await supabase
    .from("builder_site_versions")
    .select(VERSION_COLUMNS)
    .eq("id", site.draft_version_id)
    .maybeSingle();

  const version = row ? toVersion(row) : null;
  if (!version) {
    // A published pointer that no longer parses. Returning null makes the public
    // route fall back to the legacy document path, which is the safe outcome —
    // but it is also silent, and a canary needs to know it happened.
    logSiteSpecFailure("RENDER_FAILED", {
      siteId: site.id,
      businessId: site.business_id,
      surface: "published",
      reason: row ? "unreadable_spec" : "version_missing"
    });
    return null;
  }

  return {
    siteId: site.id,
    businessId: site.business_id,
    slug: site.slug,
    versionId: version.id,
    versionNumber: version.versionNumber,
    spec: version.spec
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Assets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The site's asset rows, for resolving pinned media. Reuses the existing
 * `builder_site_assets` table rather than introducing a parallel store.
 */
export const loadSiteAssets = async (
  supabase: SupabaseLike,
  siteId: string
): Promise<Array<{ id: string; url: string; alt: string | null }>> => {
  const { data, error } = await supabase
    .from("builder_site_assets")
    .select("id, url, kind")
    .eq("site_id", siteId);

  if (error) return [];
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    url: row.url,
    // `builder_site_assets` has no alt column; the spec's own `alt` is the
    // accessible name, and this is only the fallback when it is blank.
    alt: null
  }));
};
