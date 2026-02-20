import { NextResponse } from "next/server";
import { guardAdminRoute } from "@/lib/admin/guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESET_MESSAGES: Record<string, { title: string; body: string; severity: "info" | "success" | "warning" | "critical" | "celebration" }> = {
  bug_fixed: {
    title: "Update: Bug fix shipped",
    body: "Thanks for reporting this. We fixed the issue and deployed an update. Please refresh and try again.",
    severity: "success"
  },
  improvement_shipped: {
    title: "Update: Improvement shipped",
    body: "We shipped an improvement based on your feedback. Thanks for helping us make the product better.",
    severity: "success"
  },
  active_work: {
    title: "Update: We’re actively improving this",
    body: "We reviewed your report and started work. Thanks for your patience while we improve this area.",
    severity: "info"
  }
};

export async function POST(
  request: Request,
  {
    params
  }: {
    params: { id: string };
  }
) {
  const guard = await guardAdminRoute();
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json().catch(() => null)) as {
      preset?: string;
      message?: string;
      title?: string;
    } | null;

    const preset = (body?.preset ?? "bug_fixed").trim();
    const presetContent = PRESET_MESSAGES[preset] ?? PRESET_MESSAGES.bug_fixed;
    const title = (body?.title ?? presetContent.title).trim();
    const message = (body?.message ?? presetContent.body).trim();

    if (!title || title.length < 4 || title.length > 120) {
      return NextResponse.json({ error: "Title must be between 4 and 120 characters." }, { status: 400 });
    }
    if (!message || message.length < 10 || message.length > 1000) {
      return NextResponse.json({ error: "Message must be between 10 and 1000 characters." }, { status: 400 });
    }

    const { data: report, error: reportError } = await (guard.supabase as any)
      .from("feedback_reports")
      .select("id, title, business_id")
      .eq("id", params.id)
      .maybeSingle();

    if (reportError) {
      return NextResponse.json({ error: reportError.message ?? "Failed to load feedback report." }, { status: 400 });
    }
    if (!report) {
      return NextResponse.json({ error: "Feedback report not found." }, { status: 404 });
    }
    if (!report.business_id) {
      return NextResponse.json({ error: "This report is not linked to a business account." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: notification, error: notificationError } = await (admin as any)
      .from("notifications")
      .insert({
        business_id: report.business_id,
        title,
        body: message,
        severity: presetContent.severity,
        category: "product",
        cta_label: "Open dashboard",
        cta_url: "/dashboard",
        data: {
          kind: "improvement_notice",
          feedback_report_id: report.id,
          feedback_report_title: report.title,
          admin_user_id: guard.userId,
          preset
        }
      })
      .select("id")
      .single();

    if (notificationError) {
      return NextResponse.json({ error: notificationError.message ?? "Failed to send business notification." }, { status: 400 });
    }

    await (guard.supabase as any).from("feedback_internal_comments").insert({
      report_id: report.id,
      admin_user_id: guard.userId,
      type: "comment",
      message: `Sent business update notification: "${title}"`,
      meta: {
        notification_id: notification?.id ?? null,
        preset
      }
    });

    return NextResponse.json({ id: notification?.id ?? null }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send business notification."
      },
      { status: 400 }
    );
  }
}
