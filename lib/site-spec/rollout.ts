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
