/**
 * An in-memory stand-in for the two tables and three functions the Site Spec
 * store talks to.
 *
 * It implements the SEMANTICS the migration defines — monotonic version
 * numbers, an append-only history, pointers that must belong to the site,
 * publish as a pointer move — so a store test proves the contract rather than
 * proving that a mock was called.
 */
export type FakeSiteRow = {
  id: string;
  business_id: string;
  slug: string;
  status: string;
  draft_version_id: string | null;
  published_version_id: string | null;
  spec_published_at: string | null;
  updated_at: string;
};

export type FakeVersionRow = {
  id: string;
  site_id: string;
  business_id: string;
  version_number: number;
  spec: unknown;
  source: string;
  label: string | null;
  parent_version_id: string | null;
  restored_from_version_id: string | null;
  created_at: string;
};

type Result = { data: unknown; error: unknown };

/** Deterministic, readable ids — a fixture must not depend on randomness. */
const makeIdFactory = (prefix: string) => {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}${String(n).padStart(4, "0")}-1111-4111-8111-000000000000`.slice(0, 36);
  };
};

class Query implements PromiseLike<Result> {
  private filters: Array<[string, unknown]> = [];
  private sortKey: string | null = null;
  private sortAsc = true;
  private max: number | null = null;

  constructor(private rows: Record<string, unknown>[]) {}

  select(_columns?: string) {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sortKey = column;
    this.sortAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.max = count;
    return this;
  }

  private resolveRows() {
    let rows = this.rows.filter((row) =>
      this.filters.every(([column, value]) => row[column] === value)
    );
    if (this.sortKey) {
      const key = this.sortKey;
      rows = [...rows].sort((a, b) => {
        const av = a[key] as number | string;
        const bv = b[key] as number | string;
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (this.sortAsc ? 1 : -1);
      });
    }
    if (this.max != null) rows = rows.slice(0, this.max);
    return rows.map((row) => ({ ...row }));
  }

  async maybeSingle(): Promise<Result> {
    const rows = this.resolveRows();
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.resolveRows(), error: null } as Result).then(
      onfulfilled,
      onrejected
    );
  }
}

export class FakeSiteDb {
  sites: FakeSiteRow[] = [];
  versions: FakeVersionRow[] = [];
  assets: Array<{ id: string; site_id: string; url: string; kind: string }> = [];

  private nextVersionId = makeIdFactory("dddd");
  private clock = 0;

  /** Monotonic, deterministic timestamps — no wall clock in a test. */
  private stamp() {
    this.clock += 1;
    return new Date(Date.UTC(2026, 8, 1, 0, 0, this.clock)).toISOString();
  }

  addSite(row: Partial<FakeSiteRow> & { id: string; business_id: string; slug: string }): FakeSiteRow {
    const site: FakeSiteRow = {
      status: "draft",
      draft_version_id: null,
      published_version_id: null,
      spec_published_at: null,
      updated_at: this.stamp(),
      ...row
    };
    this.sites.push(site);
    return site;
  }

  private site(id: string) {
    return this.sites.find((row) => row.id === id) ?? null;
  }

  from(table: string) {
    if (table === "builder_sites") return new Query(this.sites as unknown as Record<string, unknown>[]);
    if (table === "builder_site_versions")
      return new Query(this.versions as unknown as Record<string, unknown>[]);
    if (table === "builder_site_assets")
      return new Query(this.assets as unknown as Record<string, unknown>[]);
    return new Query([]);
  }

  async rpc(fn: string, args: Record<string, unknown>): Promise<Result> {
    const fail = (message: string, code?: string): Result => ({
      data: null,
      error: code ? { message, code } : { message }
    });

    if (fn === "builder_site_create_version") {
      const site = this.site(args.p_site_id as string);
      if (!site) return fail("site not found");

      // Mirrors the migration's compare-and-append. `p_expected_parent` null
      // means "no claim"; a claim that does not match the current draft raises
      // PT409, which is what PostgREST turns into a 409 for the real client.
      const expected = (args.p_expected_parent as string | null | undefined) ?? null;
      if (expected !== null && site.draft_version_id !== expected) {
        return fail(
          `site ${site.id} draft moved: expected ${expected} but found ${site.draft_version_id}`,
          "PT409"
        );
      }

      const next =
        Math.max(
          0,
          ...this.versions.filter((v) => v.site_id === site.id).map((v) => v.version_number)
        ) + 1;
      const row: FakeVersionRow = {
        id: this.nextVersionId(),
        site_id: site.id,
        business_id: site.business_id,
        version_number: next,
        spec: args.p_spec,
        source: (args.p_source as string) ?? "edit",
        label: (args.p_label as string) ?? null,
        parent_version_id: site.draft_version_id,
        restored_from_version_id: (args.p_restored_from as string) ?? null,
        created_at: this.stamp()
      };
      this.versions.push(row);
      // The draft moves; the published pointer is deliberately untouched.
      site.draft_version_id = row.id;
      site.updated_at = this.stamp();
      return { data: { ...row }, error: null };
    }

    if (fn === "builder_site_publish") {
      const site = this.site(args.p_site_id as string);
      if (!site) return fail("site not found");
      const target = (args.p_version_id as string) ?? site.draft_version_id;
      if (!target) return fail("site has no draft version to publish");
      const version = this.versions.find((v) => v.id === target);
      if (!version || version.site_id !== site.id) {
        return fail("version does not belong to site");
      }
      site.published_version_id = target;
      site.spec_published_at = this.stamp();
      site.status = "published";
      site.updated_at = this.stamp();
      return { data: { ...site }, error: null };
    }

    if (fn === "builder_site_unpublish") {
      const site = this.site(args.p_site_id as string);
      if (!site) return fail("site not found");
      site.published_version_id = null;
      site.spec_published_at = null;
      site.status = "draft";
      return { data: { ...site }, error: null };
    }

    if (fn === "builder_site_restore_version") {
      const site = this.site(args.p_site_id as string);
      if (!site) return fail("site not found");
      const source = this.versions.find(
        (v) => v.id === (args.p_version_id as string) && v.site_id === site.id
      );
      if (!source) return fail("version does not belong to site");
      return this.rpc("builder_site_create_version", {
        p_site_id: site.id,
        p_spec: source.spec,
        p_source: "restore",
        p_label: source.label ?? `Restored version ${source.version_number}`,
        p_restored_from: source.id,
        // A restore names its target explicitly and makes no claim about the draft.
        p_expected_parent: null
      });
    }

    return fail(`unknown function ${fn}`);
  }
}
