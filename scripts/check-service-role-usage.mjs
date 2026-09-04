#!/usr/bin/env node
/**
 * Service-role usage guardrail.
 *
 * The service-role ("master key") Supabase client BYPASSES Row-Level Security.
 * Any query made with it MUST be scoped to the caller's own business — either by
 * deriving the businessId from the authenticated session (requireBusinessUser /
 * getTenantFromSession) or by verifying ownership of the resource id from the
 * request (getOwnedBuilderSite, ensure...BusinessAccess, an explicit owner check,
 * or a widget_key/published-site lookup). A route must NEVER trust a business/
 * resource id taken directly from the request body without an ownership check.
 *
 * This script freezes the set of API routes that currently use the service-role
 * client (each reviewed once) and fails CI if a NEW route starts using it without
 * being added to the allowlist — forcing a deliberate security review of every
 * future master-key route.
 *
 * Run: node scripts/check-service-role-usage.mjs   (also wired as `npm run check:service-role`)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const API_DIR = join(ROOT, "app", "api");

const SERVICE_ROLE_PATTERN =
  /getSupabaseAdminClient|getSupabaseAdminClientIfAvailable|createAdminClient|getSupabaseServerAdminClient|getSupabaseServerAdminClientIfAvailable|@\/lib\/supabase\/admin|@\/lib\/supabase\/serverAdmin/;

// Reviewed routes that legitimately use the service-role client. Each was checked
// to confirm it scopes by the caller's own business (session-derived or ownership-
// verified). Adding a file here is an explicit acknowledgement that you reviewed it.
const ALLOWLIST = new Set([
  "app/api/account/profile/route.ts",
  "app/api/admin/business/[id]/route.ts",
  "app/api/admin/feedback/[id]/notify/route.ts",
  "app/api/analytics/ingest/route.ts",
  "app/api/analytics/track/route.ts",
  "app/api/analytics/website/route.ts",
  "app/api/analytics/widget-opened/route.ts",
  "app/api/auth/register/route.ts",
  "app/api/billing/start-trial/route.ts",
  // Phase 2 Stage 4 S2: neutral booking write. businessId is session-derived via
  // requireBusinessUser (never client-supplied); admin client is scoped to that
  // business; gated to neutral write-target businesses. Dormant until cutover.
  "app/api/booking/create/route.ts",
  // Phase 2 Stage 4 S6: any-available booking. Same review as booking/create —
  // businessId session-derived, admin client scoped to it, gated to neutral
  // write-target businesses. Dormant until cutover.
  "app/api/booking/any-available/route.ts",
  // Phase 2 Stage 4 S11: public no-account manage-booking. Authorization is the
  // SHA-256 token hash scoped to exactly one booking (manage_booking RPC); the
  // admin client only reaches that single row. Rate-limited; no cross-booking access.
  "app/api/manage-booking/[token]/route.ts",
  // Phase 2 Stage 4 S12: staff availability preview. businessId session-derived;
  // admin client scoped to it via the availability data layer. Read-only.
  "app/api/booking/availability/route.ts",
  // Phase 2 Stage 4 S10: scheduled notification dispatcher. CRON_SECRET-guarded;
  // admin client processes the provider-neutral outbox out-of-band. Dormant until
  // neutral bookings emit events.
  "app/api/cron/dispatch-notifications/route.ts",
  "app/api/bot-settings/route.ts",
  "app/api/builder/ai-edit/route.ts",
  "app/api/builder/generate/route.ts",
  "app/api/builder/publish/route.ts",
  "app/api/builder/regenerate-section-v2/route.ts",
  "app/api/builder/save-draft/route.ts",
  "app/api/builder/site/route.ts",
  "app/api/builder/studio-edit/route.ts",
  "app/api/builder/upload-image/route.ts",
  "app/api/chat/feedback/route.ts",
  "app/api/chat/lead/route.ts",
  "app/api/chat/owner-send/route.ts",
  "app/api/chat/send/route.ts",
  "app/api/chatbot/sales/route.ts",
  "app/api/cron/monthly-insights/route.ts",
  "app/api/cron/renewals/route.ts",
  "app/api/cron/run/route.ts",
  "app/api/cron/weekly-health/route.ts",
  "app/api/cron/weekly-insights/route.ts",
  "app/api/dashboard/onboarding/route.ts",
  "app/api/documents/upload/route.ts",
  "app/api/errors/ingest/route.ts",
  "app/api/impact/compute/route.ts",
  "app/api/knowledge/ingest/route.ts",
  "app/api/logos/upload/route.ts",
  "app/api/meta/webhook/route.ts",
  "app/api/notifications/archive/route.ts",
  "app/api/notifications/list/route.ts",
  "app/api/notifications/mark-all-read/route.ts",
  "app/api/notifications/mark-read/route.ts",
  "app/api/notifications/simulate/monthly/route.ts",
  "app/api/notifications/simulate/weekly/route.ts",
  "app/api/onboarding/restaurant/route.ts",
  "app/api/onboarding/submit/route.ts",
  "app/api/paysera/callback/route.ts",
  "app/api/requests/create/route.ts",
  "app/api/reservations/[id]/update/route.ts",
  "app/api/reservations/availability/route.ts",
  "app/api/reservations/create/route.ts",
  "app/api/reservations/list/route.ts",
  "app/api/reservations/manual/route.ts",
  "app/api/reservations/ops/route.ts",
  "app/api/reservations/settings/route.ts",
  // Public availability for a PUBLISHED Site Spec website. A visitor has no
  // session, so RLS cannot apply. Reviewed: businessId is derived from
  // slug + status='published' + a published_version_id — never from the request —
  // and the route is read-only, returning availability slots and nothing else.
  "app/api/site-spec/booking/route.ts",
  "app/api/site/forms/submit/route.ts",
  "app/api/widget/config/route.ts",
  "app/api/widget/loader/route.ts",
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const toRel = (full) => relative(ROOT, full).split(sep).join("/");

const using = [];
for (const file of walk(API_DIR)) {
  const content = readFileSync(file, "utf8");
  if (SERVICE_ROLE_PATTERN.test(content)) {
    using.push(toRel(file));
  }
}

const unreviewed = using.filter((f) => !ALLOWLIST.has(f)).sort();
const stale = [...ALLOWLIST].filter((f) => !using.includes(f)).sort();

if (stale.length) {
  console.warn(
    "[service-role-guard] Note: these allowlisted routes no longer use the service-role client and can be removed from the allowlist:"
  );
  stale.forEach((f) => console.warn("  - " + f));
  console.warn("");
}

if (unreviewed.length) {
  console.error(
    "\n[service-role-guard] FAIL — these API routes use the service-role (master-key) Supabase client but have NOT been security-reviewed:\n"
  );
  unreviewed.forEach((f) => console.error("  - " + f));
  console.error(
    "\nThe service-role client BYPASSES Row-Level Security. Before allowlisting, confirm the route scopes EVERY query/insert/update/delete to the caller's own business:\n" +
      "  • derive businessId from the session (requireBusinessUser / getTenantFromSession), OR\n" +
      "  • verify ownership of any id taken from the request (getOwnedBuilderSite, ensure...BusinessAccess, explicit owner check, or widget_key/published-site lookup).\n" +
      "  • NEVER trust a business/resource id from the request body without an ownership check.\n" +
      "\nOnce reviewed, add the file to ALLOWLIST in scripts/check-service-role-usage.mjs.\n"
  );
  process.exit(1);
}

console.log(
  `[service-role-guard] OK — ${using.length} reviewed service-role route(s), no unreviewed additions.`
);
