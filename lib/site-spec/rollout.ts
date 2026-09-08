/**
 * The Site Spec rollout flag.
 *
 * This is the one question every Site Spec entry point asks before doing
 * anything: *is this business on the new website model yet?* It is deliberately
 * a different question from `website_builder`, which is a billing entitlement —
 * "this business pays for a website builder" is already true for most paying
 * businesses and says nothing about whether they should be moved onto a
 * renderer that has never served a customer.
 *
 * Three properties matter more than the mechanism:
 *
 *  · **Server-authoritative.** Hiding the dashboard card is not a flag. Every
 *    mutating route and the public renderer check this, so a disabled business
 *    cannot reach generation or editing by guessing a URL.
 *  · **Fail closed.** Anything that is not a clear "yes" — no row, no table,
 *    a database error, a missing business id — resolves to `off`. That is what
 *    makes it safe to deploy this code BEFORE the migration is applied: until
 *    the table exists, every business is off and every site keeps the legacy
 *    path, which is exactly the intended pre-rollout state.
 *  · **Reversible without deletion.** Turning a business off changes which
 *    renderer serves it. It does not touch a single version row, the draft
 *    pointer, or the published pointer, so flag-off is a true rollback and
 *    flag-on afterwards resumes exactly where the owner left off.
 *
 * Every caller asks exactly once per request — the guard before it does any
 * work, the public loader before it assembles a page — so the state is read
 * fresh each time rather than cached anywhere. That is deliberate: a cache is
 * what would make turning the flag off take an unpredictable amount of time to
 * bite, and the flag is the rollback lever.
 */
export const ROLLOUT_STATES = ["off", "canary", "enabled"] as const;
export type SiteSpecRolloutState = (typeof ROLLOUT_STATES)[number];

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

const isRolloutState = (value: unknown): value is SiteSpecRolloutState =>
  typeof value === "string" && (ROLLOUT_STATES as readonly string[]).includes(value);

/**
 * Resolve one business's rollout state.
 *
 * Exported unmemoised so tests and harnesses can drive it with a stub client.
 */
export const resolveRolloutState = async (
  supabase: SupabaseLike,
  businessId: string
): Promise<SiteSpecRolloutState> => {
  if (!businessId) return "off";

  try {
    const { data, error } = await supabase.rpc("site_spec_rollout_state", {
      target_business_id: businessId
    });
    // A missing function (migration not applied yet) is an error here, and the
    // right reading of it is "not rolled out", not "assume yes".
    if (error) return "off";
    const value = Array.isArray(data) ? data[0] : data;
    return isRolloutState(value) ? value : "off";
  } catch {
    return "off";
  }
};

/** The only thing callers usually need. */
export const isSiteSpecEnabled = async (
  supabase: SupabaseLike,
  businessId: string
): Promise<boolean> => (await resolveRolloutState(supabase, businessId)) !== "off";

/**
 * What the PUBLIC is served — a different question from `state`.
 *
 * Stage 3D drilled a rollback by turning the flag off and watched the canary's
 * website return 404, because a Site-Spec-only business has no legacy document
 * to fall back to. Nothing was lost — every version, asset and pointer survived
 * — but for as long as the flag was off the customer's website was gone. That
 * is a fine property for an internal canary and an unacceptable one for a real
 * business, and it came from one column answering two questions.
 *
 * So they are two questions now:
 *
 *   `state`        may this owner use the new builder?     off / canary / enabled
 *   `public_mode`  what does a visitor see?                site_spec /
 *                                                          legacy_fallback /
 *                                                          maintenance
 *
 * Withdrawing the editor no longer takes a website down, and putting a website
 * into a holding state no longer destroys anything.
 *
 * On failure this deliberately does NOT fall back to a fixed answer. The first
 * build of this function resolved every unknown to `legacy_fallback`, which
 * reads as the safe choice until you notice what it means for the one business
 * it would affect: Siround has no legacy document, so `legacy_fallback` is a
 * 404, and deploying this code before its own migration would have taken the
 * canary's website off the internet — the exact failure this whole change exists
 * to prevent, caused by the change itself.
 *
 * So an unanswerable `public_mode` falls back to the *historic rule* instead:
 * whatever `state` says today. Behaviour is then identical before and after the
 * migration, in either order, and the new column only ever adds choices.
 */
export const PUBLIC_MODES = ["site_spec", "legacy_fallback", "maintenance"] as const;
export type SiteSpecPublicMode = (typeof PUBLIC_MODES)[number];

const isPublicMode = (value: unknown): value is SiteSpecPublicMode =>
  typeof value === "string" && (PUBLIC_MODES as readonly string[]).includes(value);

export const resolvePublicMode = async (
  supabase: SupabaseLike,
  businessId: string
): Promise<SiteSpecPublicMode> => {
  if (!businessId) return "legacy_fallback";

  try {
    const { data, error } = await supabase.rpc("site_spec_public_mode", {
      target_business_id: businessId
    });
    if (!error) {
      const value = Array.isArray(data) ? data[0] : data;
      if (isPublicMode(value)) return value;
    }
  } catch {
    /* fall through to the historic rule */
  }

  // The column or function is not there yet (or did not answer). Reproduce
  // exactly what this business was being served before Stage 3E existed.
  return (await resolveRolloutState(supabase, businessId)) === "off"
    ? "legacy_fallback"
    : "site_spec";
};
