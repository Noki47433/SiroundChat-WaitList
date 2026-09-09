/**
 * Stage 3F — an owner session for one cohort business.
 *   npx tsx scripts/harness/stage3f-session.ts <2|3|4|5>
 *
 * Prints `{ siteId, slug, businessId, cookie }` as JSON so the journey scripts
 * can drive the real owner routes rather than reaching past them into the
 * database. The session comes from an admin-issued magic link, exchanged for a
 * real access token — the same mechanism the canary used from Stage 3C onward.
 * No password exists for these accounts and none is ever typed.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const N = Number(process.argv[2]);
const businessId = `3f00000${N}-0000-4000-8000-000000000001`;

const main = async () => {
  const { data: site } = await admin
    .from("builder_sites")
    .select("id, slug, owner_user_id")
    .eq("business_id", businessId)
    .single();
  const { data: user } = await admin.auth.admin.getUserById(site!.owner_user_id as string);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.user!.email!
  });
  if (linkError) throw new Error(linkError.message);

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false }
  });
  const { data: session, error } = await anon.auth.verifyOtp({
    token_hash: (link as any).properties.hashed_token,
    type: "magiclink"
  });
  if (error) throw new Error(error.message);

  const ref = new URL(url).hostname.split(".")[0];
  process.stdout.write(
    JSON.stringify({
      businessId,
      siteId: site!.id,
      slug: site!.slug,
      cookie:
        `sb-${ref}-auth-token=` +
        encodeURIComponent(
          JSON.stringify([session.session!.access_token, session.session!.refresh_token, null, null, null])
        )
    })
  );
};

void main().catch((error) => {
  console.error(String(error?.message ?? error));
  process.exit(1);
});
