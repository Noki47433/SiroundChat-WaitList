import Link from "next/link";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { NotificationSettingsPanel } from "@/app/(dashboard)/dashboard/_components/NotificationSettingsPanel";
import { DemoImpactPanel } from "@/app/(dashboard)/dashboard/_components/DemoImpactPanel";
import { WrappedLauncher } from "@/app/(dashboard)/dashboard/_components/WrappedLauncher";
import { FeedbackCard } from "@/app/(dashboard)/dashboard/settings/_components/FeedbackCard";
import { listMyFeedbackReports } from "@/lib/feedback/queries";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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

  const admin = getSupabaseAdminClient();
  const myFeedbackReports = await listMyFeedbackReports({ supabase, userId: user.id, limit: 10 });
  const { data: existingSettings } = await (supabase as any)
    .from("business_notification_settings")
    .select("deliver_in_app, deliver_push, min_severity_to_toast, currency, avg_order_value, close_rate")
    .eq("business_id", business.id)
    .maybeSingle();

  let notificationSettings = existingSettings ?? null;
  if (!notificationSettings) {
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
        <h2 className="mt-2 text-3xl font-semibold">Widget key & embed snippet</h2>
        <p className="mt-2 text-sm text-white/60">Use this snippet to install your widget on any website.</p>
      </div>

      <PaywallGate entitlementKey="chatbot_embed">
        <Card className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Your widget key</p>
              <p className="mt-2 text-sm font-mono text-white">{widgetKey ?? "Not available"}</p>
            </div>
            {widgetKey ? (
              <CopyButton value={widgetKey} label="Copy key" copiedLabel="Copied" size="sm" variant="secondary" />
            ) : null}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Embed snippet</p>
            <div className="rounded-xl border border-white/10 bg-neutral-950/70 p-3 text-xs font-mono text-white">
              {embedSnippet ? (
                <pre className="whitespace-pre-wrap break-all">{embedSnippet}</pre>
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
        </Card>
      </PaywallGate>

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

      <NotificationSettingsPanel businessId={business.id} initial={notificationSettings} />
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
      <DemoImpactPanel />
    </div>
  );
}
