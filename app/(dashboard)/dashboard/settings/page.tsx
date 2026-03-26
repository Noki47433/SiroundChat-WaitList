import Link from "next/link";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { NotificationSettingsPanel } from "@/app/(dashboard)/dashboard/_components/NotificationSettingsPanel";
import { WrappedLauncher } from "@/app/(dashboard)/dashboard/_components/WrappedLauncher";
import { FeedbackCard } from "@/app/(dashboard)/dashboard/settings/_components/FeedbackCard";
import { listMyFeedbackReports } from "@/lib/feedback/queries";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PaywallGate } from "@/src/components/billing/PaywallGate";

export const dynamic = "force-dynamic";

type BusinessRow = {
  id: string;
  business_name: string | null;
  widget_key: string | null;
};

const getOrigin = () => {
  const headerList = headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
};

const generateFallbackUuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });

const generateWidgetKey = () => {
  try {
    return randomUUID();
  } catch {
    return generateFallbackUuid();
  }
};

export default async function DashboardSettingsPage() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Settings</p>
          <h2 className="mt-2 text-3xl font-semibold">Widget ownership</h2>
          <p className="mt-2 text-sm text-white/60">Log in to view your widget key.</p>
        </div>
      </div>
    );
  }

  const { data, error } = await (supabase as any)
    .from("businesses")
    .select("id, business_name, widget_key")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Settings</p>
          <h2 className="mt-2 text-3xl font-semibold">Widget ownership</h2>
          <p className="mt-2 text-sm text-white/60">
            No business found yet. Create your chatbot on the landing page first.
          </p>
        </div>
        <Link href="/" className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950">
          Go to landing
        </Link>
      </div>
    );
  }

  const business = data as BusinessRow;
  let widgetKey = business.widget_key ?? null;

  if (!widgetKey) {
    const generatedKey = generateWidgetKey();
    const { error: updateError } = await (supabase as any)
      .from("businesses")
      .update({ widget_key: generatedKey })
      .eq("id", business.id);
    if (!updateError) {
      widgetKey = generatedKey;
    }
  }

  const origin = getOrigin();
  const embedSnippet = widgetKey ? `<script src="${origin}/api/widget/loader?key=${widgetKey}" async></script>` : "";
  const webhookEndpoint = `${origin}/api/webhooks/${business.id}`;

  const admin = getSupabaseAdminClientIfAvailable();
  const myFeedbackReports = await listMyFeedbackReports({ supabase, userId: user.id, limit: 10 });
  const { data: existingSettings } = await (supabase as any)
    .from("business_notification_settings")
    .select("deliver_in_app, deliver_push, min_severity_to_toast, currency, avg_order_value, close_rate")
    .eq("business_id", business.id)
    .maybeSingle();

  let notificationSettings = existingSettings ?? null;
  if (!notificationSettings && admin) {
    const { data: created } = await (admin as any)
      .from("business_notification_settings")
      .insert({ business_id: business.id })
      .select("deliver_in_app, deliver_push, min_severity_to_toast, currency, avg_order_value, close_rate")
      .single();
    notificationSettings = created ?? {
      deliver_in_app: true,
      deliver_push: true,
      min_severity_to_toast: "success",
      currency: "EUR",
      avg_order_value: null,
      close_rate: null
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Settings</p>
        <h2 className="mt-2 text-3xl font-semibold">Workspace settings</h2>
        <p className="mt-2 text-sm text-white/60">Manage your profile, organization settings, and operational controls.</p>
      </div>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Profile / Org basics</p>
        <Card className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Organization</p>
            <p className="mt-2 text-base font-semibold text-white">{business.business_name ?? "Your business"}</p>
          </div>

          <PaywallGate entitlementKey="chatbot_embed">
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Widget key</p>
                  <p className="mt-2 text-sm font-mono text-white">{widgetKey ?? "Not available"}</p>
                </div>
                {widgetKey ? (
                  <CopyButton value={widgetKey} label="Copy key" copiedLabel="Copied" size="sm" variant="secondary" />
                ) : null}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-white">Embed snippet</p>
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-neutral-950/70 p-3 text-xs font-mono text-white">
                  {embedSnippet ? (
                    <>
                      <pre className="pointer-events-none whitespace-pre-wrap break-all blur-[7px] select-none">
                        {embedSnippet}
                      </pre>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
                    </>
                  ) : (
                    <p className="text-white/60">Generate a widget key to see the snippet.</p>
                  )}
                </div>
                {embedSnippet ? (
                  <div className="flex justify-end">
                    <CopyButton value={embedSnippet} label="Copy snippet" copiedLabel="Copied" size="sm" variant="secondary" />
                  </div>
                ) : null}
              </div>
            </div>
          </PaywallGate>
        </Card>
      </section>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Billing</p>
        <Card className="space-y-3">
          <p className="text-sm text-white/70">
            Plan management, invoices, and upgrade controls live in Billing.
          </p>
          <div>
            <Link
              href="/billing"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white hover:bg-white/10"
            >
              Open Billing
            </Link>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Notifications</p>
        <NotificationSettingsPanel businessId={business.id} initial={notificationSettings} />
      </section>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Danger zone</p>
        <Card className="space-y-3 border-red-500/30">
          <p className="text-sm text-white/70">
            Need to end your session or adjust sensitive account settings? Use the account page controls.
          </p>
          <div>
            <Link
              href="/dashboard/account"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-red-400/40 px-4 text-sm font-semibold text-red-200 hover:bg-red-500/10"
            >
              Open Account Controls
            </Link>
          </div>
        </Card>
      </section>

      <PaywallGate entitlementKey="webhooks">
        <Card className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Webhooks</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Automation endpoint</h3>
            <p className="mt-1 text-sm text-white/60">
              Connect external workflows with webhook events from your workspace.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-neutral-950/70 p-3 text-xs font-mono text-white">
            <pre className="whitespace-pre-wrap break-all">{webhookEndpoint}</pre>
          </div>
          <div className="flex justify-end">
            <CopyButton value={webhookEndpoint} label="Copy endpoint" copiedLabel="Copied" size="sm" variant="secondary" />
          </div>
        </Card>
      </PaywallGate>

      <FeedbackCard
        initialRows={myFeedbackReports.map((row) => ({
          id: row.id,
          created_at: row.created_at,
          title: row.title,
          category: row.category,
          importance: row.importance,
          status: row.status,
          triage_status: row.triage_status,
          priority: row.priority
        }))}
        initialContactEmail={user.email ?? null}
      />
      <WrappedLauncher businessId={business.id} />
    </div>
  );
}
