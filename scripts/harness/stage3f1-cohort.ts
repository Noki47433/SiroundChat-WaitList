/**
 * Stage 3F.1 — the five businesses, and the baseline each one starts from.
 *
 * A reliability number is only comparable to the one before it if the sites are
 * in the same state when the run begins. Stage 3F's run began at v13 on each of
 * the four new businesses and at spec `a880…` on the canary; those are therefore
 * the baselines here, so this rerun replicates that run rather than resembling
 * it.
 *
 * Every field below was read from production and written down BEFORE anything
 * was restored or re-measured. The fingerprints are canonical — object keys
 * sorted — so a restore that reorders JSON keys still proves equal.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export type CohortEntry = {
  n: number;
  label: string;
  slug: string;
  businessId: string;
  siteId: string;
  /** The version the draft is restored to before the run. Append-only, so immutable. */
  baselineVersionId: string;
  baselineVersionNumber: number;
  /** Declared here so the harness can prove the baseline is the one it was told about. */
  baselineFingerprint: string;
};

export const COHORT: readonly CohortEntry[] = [
  {
    n: 1,
    label: "Siround (canary)",
    slug: "siround",
    businessId: "e7387690-bef7-4a9d-bcf5-0830d713e7c4",
    siteId: "3cdab74f-1ae0-4ef0-94e7-1cf60f7b59c1",
    // v112, v140 and v144 all restore this same spec: it is the controlled
    // baseline Stage 3E.1 measured from and returned to afterwards.
    baselineVersionId: "8e35a424-9426-49ce-8737-5735748cc6b2",
    baselineVersionNumber: 144,
    baselineFingerprint: "cb9bb2f32fb8a55808cd82975aee36e9423a5d088bc9cc3756ad1ac05333f3cd"
  },
  {
    n: 2,
    label: "Solo Studio",
    slug: "stage3f-solo-studio",
    businessId: "3f000002-0000-4000-8000-000000000001",
    siteId: "3f000002-0000-4000-8000-000000000005",
    baselineVersionId: "1bb03c63-81df-4fad-8227-2ac3f8bf8f52",
    baselineVersionNumber: 13,
    baselineFingerprint: "32a030b32c226a994fe1eefbb04bb8910788772223ed2e6bef125cea9171667e"
  },
  {
    n: 3,
    label: "Two Chairs",
    slug: "stage3f-two-chairs",
    businessId: "3f000003-0000-4000-8000-000000000001",
    siteId: "3f000003-0000-4000-8000-000000000005",
    baselineVersionId: "1b300f79-ee90-4a0e-b027-febee3d1eaf8",
    baselineVersionNumber: 13,
    baselineFingerprint: "77b562593bf31501f56be150de6bb981eb95a1a9d928ed86857d50c4c86fda3b"
  },
  {
    n: 4,
    label: "Late & Closed",
    slug: "stage3f-late-and-closed",
    businessId: "3f000004-0000-4000-8000-000000000001",
    siteId: "3f000004-0000-4000-8000-000000000005",
    baselineVersionId: "0ad0d07c-5be9-410a-b0c8-2e1db85f7116",
    baselineVersionNumber: 13,
    baselineFingerprint: "eb164ed7b901fb3242e2787fba0b075b874ab1cf9dfe27f33b5d486a2ed2ad39"
  },
  {
    n: 5,
    label: "Atelier Nord",
    slug: "stage3f-atelier-nord",
    businessId: "3f000005-0000-4000-8000-000000000001",
    siteId: "3f000005-0000-4000-8000-000000000005",
    baselineVersionId: "f2d6bdc2-95cd-4643-bfd8-e96b5c7d2a3b",
    baselineVersionNumber: 13,
    baselineFingerprint: "30147c7a45a94677ec3de2fd7070152668a49ecf4bf7553ee417f39bb100648c"
  }
];

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false }
  });

/** Key order must not decide whether two specs are the same spec. */
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])])
        )
      : value;

export const fingerprint = (spec: unknown) =>
  createHash("sha256").update(JSON.stringify(canonical(spec))).digest("hex");

/** Visible text only — scripts, styles and markup carry build ids that move on every deploy. */
export const pageFingerprint = (html: string) =>
  createHash("sha256")
    .update(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .digest("hex");

/**
 * An owner session for one cohort business, through an admin-issued magic link.
 * No password exists for these accounts and none is ever typed; the canary has
 * used the same mechanism since Stage 3C.
 */
export const sessionFor = async (entry: CohortEntry) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const db = admin();
  const { data: site, error } = await db
    .from("builder_sites")
    .select("id, owner_user_id")
    .eq("id", entry.siteId)
    .single();
  if (error || !site) throw new Error(`no site for ${entry.slug}: ${error?.message}`);

  const { data: user } = await db.auth.admin.getUserById(site.owner_user_id as string);
  const { data: link, error: linkError } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: user.user!.email!
  });
  if (linkError) throw new Error(linkError.message);

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false }
  });
  const { data: session, error: otpError } = await anon.auth.verifyOtp({
    token_hash: (link as any).properties.hashed_token,
    type: "magiclink"
  });
  if (otpError) throw new Error(otpError.message);

  const ref = new URL(url).hostname.split(".")[0];
  return (
    `sb-${ref}-auth-token=` +
    encodeURIComponent(
      JSON.stringify([session.session!.access_token, session.session!.refresh_token, null, null, null])
    )
  );
};
