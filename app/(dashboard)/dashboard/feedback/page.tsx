import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromSession } from "@/lib/utils/tenant";
import { FeedbackFilters } from "@/app/(dashboard)/dashboard/feedback/_components/FeedbackFilters.client";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS = {
  "7d": 7,
  "30d": 30,
  "90d": 90
} as const;

type RangeKey = keyof typeof RANGE_OPTIONS;

const DAY_MS = 24 * 60 * 60 * 1000;

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const truncate = (value: string, max = 140) => (value.length > max ? `${value.slice(0, max)}...` : value);

const panelClass =
  "rounded-3xl border border-white/10 bg-[#0f120f] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.45)]";
const subtlePanelClass = "rounded-2xl border border-white/10 bg-[#0b0e0b] p-4";

export default async function FeedbackPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const rangeParam = (searchParams?.range ?? "30d") as RangeKey;
  const rangeKey: RangeKey = RANGE_OPTIONS[rangeParam] ? rangeParam : "30d";
  const rangeDays = RANGE_OPTIONS[rangeKey];
  const siteParam = typeof searchParams?.site === "string" ? searchParams.site : null;

  const tenant = await getTenantFromSession();
  const supabase = getSupabaseServerClient();

  if (!tenant.businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Dashboards / Feedback</p>
        <h2 className="text-3xl font-semibold">Feedback Overview</h2>
        <p className="text-sm text-white/60">Log in to review conversation feedback.</p>
      </div>
    );
  }

  const rangeStart = new Date(Date.now() - rangeDays * DAY_MS);
  const rangeStartIso = rangeStart.toISOString();

  const { data: sites } = await (supabase as any)
    .from("websites")
    .select("id, site_name")
    .eq("business_id", tenant.businessId)
    .order("created_at", { ascending: false });

  let feedbackQuery = (supabase as any)
    .from("conversation_feedback")
    .select("id, rating, tags, comment, created_at, conversation_id, message_id, site_id, chat_conversations!inner(business_id)")
    .eq("chat_conversations.business_id", tenant.businessId)
    .gte("created_at", rangeStartIso)
    .order("created_at", { ascending: false })
    .limit(500);

  if (siteParam) {
    feedbackQuery = feedbackQuery.eq("site_id", siteParam);
  }

  const { data: feedbackRows, error: feedbackError } = await feedbackQuery;

  if (feedbackError) {
    return <p className="text-sm text-white/60">Unable to load feedback.</p>;
  }

  const feedback = (feedbackRows ?? []) as Array<{
    id: string;
    rating: "up" | "down";
    tags?: string[] | null;
    comment?: string | null;
    created_at: string;
    conversation_id: string;
    message_id: string;
    site_id?: string | null;
  }>;

  const totalCount = feedback.length;
  const helpfulCount = feedback.filter((row) => row.rating === "up").length;
  const helpfulRate = totalCount ? Math.round((helpfulCount / totalCount) * 100) : 0;
  const negativeRows = feedback.filter((row) => row.rating === "down");
  const negativeRate = totalCount ? Math.round((negativeRows.length / totalCount) * 100) : 0;

  const tagCounts = new Map<string, number>();
  negativeRows.forEach((row) => {
    (row.tags ?? []).forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
  });
  const topTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);

  const recentNegative = negativeRows.slice(0, 10);
  const recentFeedback = feedback.slice(0, 8);
  const recentNotes = feedback.filter((row) => row.comment && row.comment.trim()).slice(0, 6);

  const messageIds = Array.from(
    new Set(
      [...recentNegative, ...recentFeedback]
        .map((row) => row.message_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let messageMap = new Map<string, string>();
  if (messageIds.length) {
    const { data: messageRows } = await (supabase as any)
      .from("chat_messages")
      .select("id, message_text")
      .in("id", messageIds);

    messageMap = new Map((messageRows ?? []).map((row: any) => [row.id, row.message_text]));
  }

  const siteOptions = (sites ?? []).map((site: { id: string; site_name?: string | null }) => ({
    id: site.id,
    name: site.site_name ?? "Untitled site"
  }));

  const accent = "#A6F36A";

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-[36px] bg-[radial-gradient(circle_at_top,#1b3a24,transparent_55%),linear-gradient(180deg,#0c110d,transparent_60%)]" />

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">Dashboards / Feedback</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-white">Feedback Overview</h2>
            <p className="mt-2 text-sm text-white/60">Monitor helpfulness, understand negative reasons, and spot trends.</p>
          </div>
          <div className={subtlePanelClass}>
            <FeedbackFilters range={rangeKey} siteId={siteParam} sites={siteOptions} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className={subtlePanelClass}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Helpful rate</p>
          <p className="mt-3 text-2xl font-semibold text-white">{helpfulRate}%</p>
          <div className="mt-3 h-1.5 rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${helpfulRate}%`, background: accent }} />
          </div>
        </div>
        <div className={subtlePanelClass}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Total feedback</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(totalCount)}</p>
          <p className="mt-2 text-xs text-white/50">In selected range</p>
        </div>
        <div className={subtlePanelClass}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Negative submissions</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(negativeRows.length)}</p>
          <p className="mt-2 text-xs text-white/50">Needs attention</p>
        </div>
        <div className={subtlePanelClass}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Negative rate</p>
          <p className="mt-3 text-2xl font-semibold text-white">{negativeRate}%</p>
          <p className="mt-2 text-xs text-white/50">Share of total feedback</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className={panelClass}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Sentiment overview</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">Helpfulness</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                  Last {rangeDays} days
                </span>
              </div>
              <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
                <div
                  className="relative h-36 w-36 rounded-full"
                  style={{
                    background: `conic-gradient(${accent} ${helpfulRate * 3.6}deg, rgba(255,255,255,0.08) 0deg)`
                  }}
                >
                  <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-[#0b0e0b]">
                    <span className="text-2xl font-semibold text-white">{helpfulRate}%</span>
                    <span className="text-xs text-white/50">Helpful</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">Helpful</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatNumber(helpfulCount)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">Needs work</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatNumber(negativeRows.length)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">Total</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatNumber(totalCount)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={panelClass}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Negative reasons</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">Top tags</h3>
                </div>
                <span className="text-xs text-white/50">Only from thumbs-down</span>
              </div>
              <div className="mt-5 space-y-4">
                {topTags.length ? (
                  topTags.slice(0, 6).map(([tag, count]) => {
                    const percent = negativeRows.length ? Math.round((count / negativeRows.length) * 100) : 0;
                    return (
                      <div key={tag} className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-white/80">
                          <span>{tag}</span>
                          <span className="text-xs text-white/50">{count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${percent}%`, background: accent }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-white/60">No tags captured yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className={panelClass}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Recent negatives</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Latest thumbs-down feedback</h3>
              </div>
              <span className="text-xs text-white/50">Showing {Math.min(recentNegative.length, 10)}</span>
            </div>
            <div className="mt-5 space-y-3">
              {recentNegative.map((row) => {
                const messageText = messageMap.get(row.message_id) ?? "";
                const detail = row.comment?.trim() || messageText || "No message saved";
                return (
                  <div key={row.id} className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-sm text-white/80">{truncate(detail, 160)}</p>
                      <p className="mt-2 text-xs text-white/50">{formatDateTime(row.created_at)}</p>
                    </div>
                    <Link
                      href={`/dashboard/conversations/${row.conversation_id}`}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 hover:text-white"
                    >
                      View
                    </Link>
                  </div>
                );
              })}
              {recentNegative.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/50">
                  No negative feedback in this range.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={panelClass}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Latest feedback</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Recent votes</h3>
              </div>
              <span className="text-xs text-white/50">Last {rangeDays} days</span>
            </div>
            <div className="mt-5 space-y-3">
              {recentFeedback.length ? (
                recentFeedback.map((row) => {
                  const messageText = messageMap.get(row.message_id) ?? "";
                  return (
                    <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/50">{formatDateTime(row.created_at)}</span>
                        <span
                          className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            color: row.rating === "up" ? accent : "#F38A8A",
                            background: "rgba(255,255,255,0.04)"
                          }}
                        >
                          {row.rating === "up" ? "Helpful" : "Not helpful"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/70">{messageText ? truncate(messageText, 120) : "No message"}</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-white/60">No feedback yet.</p>
              )}
            </div>
          </div>

          <div className={panelClass}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Notes</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Visitor comments</h3>
              </div>
              <span className="text-xs text-white/50">Optional details</span>
            </div>
            <div className="mt-5 space-y-3">
              {recentNotes.length ? (
                recentNotes.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-sm text-white/80">{truncate(row.comment ?? "", 140)}</p>
                    <p className="mt-2 text-xs text-white/50">{formatDateTime(row.created_at)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/60">No comments captured yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
