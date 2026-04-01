"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

type FunnelStep = {
  label: string;
  value: number;
  helper: string;
};

type IntentRow = {
  intent: string;
  total: number;
  converted: number;
  conversionRate: number;
};

type QuestionRow = {
  question: string;
  count: number;
};

type ResponseBucket = {
  label: string;
  value: number;
};

type AnalyticsTabsProps = {
  emptyState: string;
  funnelSteps: FunnelStep[];
  responseBuckets: ResponseBucket[];
  responseBucketMax: number;
  avgResponseLabel: string;
  p95ResponseLabel: string;
  qualityScore: number | null;
  intentRows: IntentRow[];
  topConvertedQuestions: QuestionRow[];
  topDroppedQuestions: QuestionRow[];
  droppedConversationCount: number;
  fallbackCount: number;
  heatmap: number[][];
  heatmapMax: number;
  peakLabel: string;
};

type TabKey = "Overview" | "Intents" | "Questions" | "Drop-off" | "Heatmap";

const TABS: TabKey[] = ["Overview", "Intents", "Questions", "Drop-off", "Heatmap"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

export default function AnalyticsTabs({
  emptyState,
  funnelSteps,
  responseBuckets,
  responseBucketMax,
  avgResponseLabel,
  p95ResponseLabel,
  qualityScore,
  intentRows,
  topConvertedQuestions,
  topDroppedQuestions,
  droppedConversationCount,
  fallbackCount,
  heatmap,
  heatmapMax,
  peakLabel
}: AnalyticsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");

  const funnelMax = Math.max(...funnelSteps.map((step) => step.value), 0);
  const totalResponses = responseBuckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const dropTotal = droppedConversationCount + fallbackCount;

  const hasFunnelData = funnelSteps.some((step) => step.value > 0);
  const hasIntentData = intentRows.length > 0;
  const hasDropData = dropTotal > 0;
  const hasQualityScore = qualityScore !== null;

  const dropSegments = useMemo(
    () => [
      { label: "Immediate drop", value: droppedConversationCount, color: "bg-amber-400" },
      { label: "Fallback", value: fallbackCount, color: "bg-rose-400" }
    ],
    [droppedConversationCount, fallbackCount]
  );

  return (
    <Card className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Insights</p>
          <p className="text-xs text-white/60">Visual drill-downs without the scroll</p>
        </div>
        <div
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-[11px]"
          data-tutorial-target="analytics-tabs"
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "rounded-full px-3 py-1 transition",
                activeTab === tab ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
              ].join(" ")}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {activeTab === "Overview" ? (
          <div className="grid gap-4 lg:grid-cols-[1.25fr,1fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Funnel</p>
              {hasFunnelData ? (
                <div className="mt-4 grid grid-cols-5 items-end gap-2">
                  {funnelSteps.map((step, index) => {
                    const height = funnelMax ? Math.min(100, Math.max((step.value / funnelMax) * 100, 8)) : 0;
                    const dropoff =
                      index === 0 || !funnelSteps[index - 1].value || step.value > funnelSteps[index - 1].value
                        ? null
                        : Math.round(((funnelSteps[index - 1].value - step.value) / funnelSteps[index - 1].value) * 100);
                    return (
                      <div key={step.label} className="flex flex-col items-center gap-2 text-center">
                        <div className="flex h-24 w-full items-end rounded-xl bg-white/5 p-1">
                          <div
                            className="w-full rounded-lg bg-gradient-to-t from-sky-500/70 via-sky-400 to-indigo-400"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-white/60">{step.label}</p>
                          <p className="text-xs text-white/80">{formatNumber(step.value)}</p>
                          <p className="text-[10px] text-white/40">{dropoff !== null ? `-${dropoff}%` : ""}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyPanel message={emptyState} />
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Response speed</p>
                {totalResponses ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-white/70">
                      <span>Average</span>
                      <span>{avgResponseLabel}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/70">
                      <span>P95</span>
                      <span>{p95ResponseLabel}</span>
                    </div>
                    <div className="space-y-2 text-xs text-white/60">
                      {responseBuckets.map((bucket) => (
                        <div key={bucket.label}>
                          <div className="flex items-center justify-between">
                            <span>{bucket.label}</span>
                            <span>{formatNumber(bucket.value)}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-white/5">
                            <div
                              className="h-2 rounded-full bg-white/40"
                              style={{ width: `${responseBucketMax ? (bucket.value / responseBucketMax) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyPanel message={emptyState} />
                )}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Quality score</p>
                {hasQualityScore ? (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-3xl font-semibold">{qualityScore}</p>
                    <div className="h-2 w-28 rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-emerald-400"
                        style={{ width: `${Math.min(Math.max(qualityScore ?? 0, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <EmptyPanel message={emptyState} />
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "Intents" ? (
          <div className="space-y-3">
            {hasIntentData ? (
              intentRows.map((intent) => (
                <div key={intent.intent} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="capitalize">{intent.intent}</span>
                    <span>
                      {formatNumber(intent.converted)} / {formatNumber(intent.total)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-emerald-400"
                      style={{ width: `${Math.max(intent.conversionRate, 4)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-white/40">{intent.conversionRate}% conversion</p>
                </div>
              ))
            ) : (
              <EmptyPanel message={emptyState} />
            )}
          </div>
        ) : null}

        {activeTab === "Questions" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Top converting</p>
              <div className="mt-3 space-y-2 text-xs text-white/70">
                {topConvertedQuestions.length ? (
                  topConvertedQuestions.map((item) => (
                    <div key={item.question} className="flex items-start justify-between gap-2">
                      <span>{item.question}</span>
                      <span className="text-white/40">{formatNumber(item.count)}</span>
                    </div>
                  ))
                ) : (
                  <EmptyPanel message={emptyState} />
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Dropped questions</p>
              <div className="mt-3 space-y-2 text-xs text-white/70">
                {topDroppedQuestions.length ? (
                  topDroppedQuestions.map((item) => (
                    <div key={item.question} className="flex items-start justify-between gap-2">
                      <span>{item.question}</span>
                      <span className="text-white/40">{formatNumber(item.count)}</span>
                    </div>
                  ))
                ) : (
                  <EmptyPanel message={emptyState} />
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "Drop-off" ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Drop-off mix</p>
            {hasDropData ? (
              <div className="mt-4 space-y-3">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/10">
                  {dropSegments.map((segment) => (
                    <div
                      key={segment.label}
                      className={segment.color}
                      style={{ width: `${dropTotal ? (segment.value / dropTotal) * 100 : 0}%` }}
                    />
                  ))}
                </div>
                <div className="space-y-2 text-xs text-white/70">
                  {dropSegments.map((segment) => (
                    <div key={segment.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${segment.color}`} />
                        <span>{segment.label}</span>
                      </div>
                      <span>{formatNumber(segment.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyPanel message={emptyState} />
            )}
          </div>
        ) : null}

        {activeTab === "Heatmap" ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Peak activity</p>
              <p className="text-[11px] text-white/50">Peak: {peakLabel}</p>
            </div>
            {heatmapMax ? (
              <div className="mt-4 space-y-2">
                <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                  {heatmap.flatMap((row, dayIdx) =>
                    row.map((count, hourIdx) => {
                      const intensity = heatmapMax ? count / heatmapMax : 0;
                      const background =
                        count === 0 ? "rgba(255,255,255,0.06)" : `rgba(56,189,248,${0.25 + intensity * 0.75})`;
                      return (
                        <div
                          key={`${dayIdx}-${hourIdx}`}
                          className="h-3 w-3 rounded-sm"
                          style={{ background }}
                          title={`${WEEKDAYS[dayIdx]} ${hourIdx}:00 - ${count}`}
                        />
                      );
                    })
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-white/40">
                  <span>Low</span>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-white/10" />
                    <span className="h-2 w-2 rounded-sm bg-sky-400/40" />
                    <span className="h-2 w-2 rounded-sm bg-sky-400" />
                  </div>
                  <span>High</span>
                </div>
              </div>
            ) : (
              <EmptyPanel message={emptyState} />
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

type EmptyPanelProps = {
  message: string;
};

function EmptyPanel({ message }: EmptyPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/50">
      {message}
    </div>
  );
}
