"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { OverviewCard } from "@/components/analytics/website/OverviewCard";
import { WorldMap } from "@/components/analytics/website/WorldMap";
import { PeakTimesChart } from "@/components/analytics/website/PeakTimesChart";
import { ChannelSplitCard } from "@/components/analytics/website/ChannelSplitCard";
import { cn } from "@/lib/utils/cn";

const RANGE_OPTIONS = ["7d", "30d", "90d"] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number];

type AnalyticsResponse = {
  range: RangeKey;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  overview: {
    visitors: { value: number; deltaPct: number };
    chatsStarted: { value: number; deltaPct: number };
    leads: { value: number; deltaPct: number };
    ctaClicks: { value: number; deltaPct: number };
  };
  overviewSeries?: {
    labels: string[];
    visitors: number[];
    chatsStarted: number[];
    leads: number[];
    ctaClicks: number[];
  };
  worldMap: {
    mode: "visitors" | "leads";
    countries: Array<{ countryCode: string | null; value: number }>;
  };
  pages: Array<{
    pagePath: string;
    pageTitle?: string | null;
    visitors: number;
    leads: number;
    chatsStarted: number;
    ctaClicks: number;
  }>;
  peakTimes: {
    hourly: Array<{ hour: number; visitors: number; interactions: number; leads: number }>;
    bestWindow: { startHour: number; endHour: number };
  };
  channelSplit: {
    leadsByChannel: { chatbot: number; form: number };
    interactionsByChannel: { chatbot: number; website: number };
  };
  nudges: Array<{ id: string; title: string; body: string; ctaLabel?: string; ctaHref?: string }>;
};

type SiteOption = {
  id: string;
  business_name?: string | null;
  slug?: string | null;
  status?: string | null;
  published_url?: string | null;
};

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const formatHour = (value: number) => `${String(value).padStart(2, "0")}:00`;

export function WebsiteInsightsDashboard({
  initialRange = "7d",
  initialSiteId,
  demo = false
}: {
  initialRange?: RangeKey;
  initialSiteId?: string | null;
  demo?: boolean;
}) {
  const [range, setRange] = useState<RangeKey>(RANGE_OPTIONS.includes(initialRange) ? initialRange : "7d");
  const [mapMode, setMapMode] = useState<"visitors" | "leads">("visitors");
  const [siteId, setSiteId] = useState<string>(initialSiteId ?? "all");
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    let active = true;
    setSitesLoading(true);
    fetch("/api/builder/sites")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load sites"))))
      .then((json) => {
        if (!active) return;
        setSites(Array.isArray(json?.sites) ? json.sites : []);
      })
      .catch(() => {
        if (!active) return;
        setSites([]);
      })
      .finally(() => {
        if (active) setSitesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleFocus = () => setRefreshTick((value) => value + 1);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    if (sitesLoading) return;
    if (siteId === "all") return;
    if (!sites.find((site) => site.id === siteId)) {
      setSiteId("all");
    }
  }, [sites, sitesLoading, siteId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const demoQuery = demo ? "&demo=1" : "";
        const siteQuery = siteId !== "all" ? `&siteId=${siteId}` : "";
        const res = await fetch(`/api/analytics/website?range=${range}&mode=${mapMode}${siteQuery}${demoQuery}`, {
          signal: controller.signal,
          cache: "no-store"
        });
        if (!res.ok) {
          throw new Error("Failed to load analytics");
        }
        const json = (await res.json()) as AnalyticsResponse;
        if (!active) return;
        setData(json);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load analytics";
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [range, mapMode, demo, siteId, refreshTick]);

  const countriesCount = useMemo(() => {
    if (!data) return 0;
    return data.worldMap.countries.filter((country) => country.countryCode).length;
  }, [data]);

  const conversionPct = useMemo(() => {
    if (!data) return 0;
    const visitors = data.overview.visitors.value;
    if (!visitors) return 0;
    return Math.round((data.overview.leads.value / visitors) * 100);
  }, [data]);

  if (error) {
    return (
      <Card className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
        {error}
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">Analytics</p>
          <h1 className="text-3xl font-semibold text-white">Website Insights</h1>
          <p className="text-sm text-white/60">Is your website bringing you customers?</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="w-56">
            <option value="all">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.business_name ?? "Untitled"}{site.slug ? ` • ${site.slug}` : ""}
              </option>
            ))}
          </Select>
          <Select
            value={range}
            onChange={(event) => setRange(event.target.value as RangeKey)}
            className="w-32"
            data-tutorial-target="website-analytics-range"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-4 h-8 w-32" />
              <Skeleton className="mt-3 h-4 w-20" />
            </Card>
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            label="Visitors"
            value={data.overview.visitors.value}
            deltaPct={data.overview.visitors.deltaPct}
            series={data.overviewSeries?.visitors}
          />
          <OverviewCard
            label="Chats Started"
            value={data.overview.chatsStarted.value}
            deltaPct={data.overview.chatsStarted.deltaPct}
            series={data.overviewSeries?.chatsStarted}
          />
          <OverviewCard
            label="Potential Customers (Leads)"
            value={data.overview.leads.value}
            deltaPct={data.overview.leads.deltaPct}
            series={data.overviewSeries?.leads}
            ringPercent={conversionPct}
          />
          <OverviewCard
            label="Calls/WhatsApp Clicks"
            value={data.overview.ctaClicks.value}
            deltaPct={data.overview.ctaClicks.deltaPct}
            series={data.overviewSeries?.ctaClicks}
          />
        </div>
      ) : null}

      <Card className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Where your visitors come from</h2>
            <p className="text-sm text-white/60">Your website reached {countriesCount} countries this period</p>
          </div>
          <div className="flex items-center rounded-full border border-white/10 bg-black/40 p-1">
            {[
              { key: "visitors", label: "Visitors" },
              { key: "leads", label: "Leads" }
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setMapMode(option.key as "visitors" | "leads")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  mapMode === option.key ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <Separator className="my-5" />
        {loading && !data ? <Skeleton className="h-[280px] w-full md:h-[440px]" /> : null}
        {data ? <WorldMap data={data.worldMap.countries} mode={data.worldMap.mode} /> : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="min-w-0 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Pages That Work</h2>
              <p className="text-sm text-white/60">Top pages driving leads and conversations</p>
            </div>
            <Badge className="border-white/10 bg-white/10 text-white/60">Top 6</Badge>
          </div>
          <Separator className="my-4" />
          {data ? (
            <div className="space-y-3">
              <div className="hidden grid-cols-[1.6fr_repeat(4,0.8fr)] text-xs uppercase tracking-[0.2em] text-white/40 md:grid">
                <span>Page</span>
                <span>Visitors</span>
                <span>Leads</span>
                <span>Chats</span>
                <span>CTA clicks</span>
              </div>
              <div className="hidden md:block">
                {data.pages.map((page, index) => (
                  <div
                    key={page.pagePath}
                    className={cn(
                      "grid grid-cols-[1.6fr_repeat(4,0.8fr)] items-center rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm",
                      index === 0 ? "border-cyan-500/30 bg-cyan-500/10" : ""
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{page.pageTitle || page.pagePath}</span>
                      {index === 0 ? (
                        <Badge className="border-cyan-400/40 bg-cyan-500/20 text-cyan-100">Top performer</Badge>
                      ) : null}
                    </div>
                    <span className="text-white/70">{formatNumber(page.visitors)}</span>
                    <span className="text-white/70">{formatNumber(page.leads)}</span>
                    <span className="text-white/70">{formatNumber(page.chatsStarted)}</span>
                    <span className="text-white/70">{formatNumber(page.ctaClicks)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3 md:hidden">
                {data.pages.map((page, index) => (
                  <div
                    key={`${page.pagePath}-mobile`}
                    className={cn(
                      "rounded-2xl border border-white/5 bg-black/20 p-4 text-sm",
                      index === 0 ? "border-cyan-500/30 bg-cyan-500/10" : ""
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">{page.pageTitle || page.pagePath}</span>
                      {index === 0 ? (
                        <Badge className="border-cyan-400/40 bg-cyan-500/20 text-cyan-100">Top performer</Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
                      <span>Visitors: {formatNumber(page.visitors)}</span>
                      <span>Leads: {formatNumber(page.leads)}</span>
                      <span>Chats: {formatNumber(page.chatsStarted)}</span>
                      <span>CTA clicks: {formatNumber(page.ctaClicks)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {!data.pages.length ? <p className="text-sm text-white/50">No page activity yet.</p> : null}
            </div>
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </Card>

        <Card className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Peak Times</h2>
            <p className="text-sm text-white/60">When visitors are most likely to engage</p>
          </div>
          <Separator className="my-4" />
          {data ? <PeakTimesChart data={data.peakTimes.hourly} /> : <Skeleton className="h-52 w-full" />}
          {data ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-white/70">
              <MapPin className="h-4 w-4 text-cyan-300" />
              Best time: {formatHour(data.peakTimes.bestWindow.startHour)}-{formatHour(data.peakTimes.bestWindow.endHour)}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Channel Split</h2>
            <p className="text-sm text-white/60">Chatbot vs. website performance</p>
          </div>
          <Separator className="my-4" />
          {data ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ChannelSplitCard
                title="Leads"
                primaryLabel="Chatbot"
                primaryValue={data.channelSplit.leadsByChannel.chatbot}
                secondaryLabel="Forms"
                secondaryValue={data.channelSplit.leadsByChannel.form}
              />
              <ChannelSplitCard
                title="Interactions"
                primaryLabel="Chatbot"
                primaryValue={data.channelSplit.interactionsByChannel.chatbot}
                secondaryLabel="Website"
                secondaryValue={data.channelSplit.interactionsByChannel.website}
              />
            </div>
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </Card>

        <Card className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Action Nudges</h2>
            <p className="text-sm text-white/60">Quick wins to turn visits into customers</p>
          </div>
          <Separator className="my-4" />
          {data ? (
            <div className="space-y-3">
              {data.nudges.map((nudge) => (
                <div key={nudge.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">{nudge.title}</h3>
                      <p className="mt-1 text-xs text-white/60">{nudge.body}</p>
                      {nudge.ctaLabel && nudge.ctaHref ? (
                        <a
                          href={nudge.ctaHref}
                          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                        >
                          {nudge.ctaLabel}
                          <span aria-hidden>{"->"}</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {!data.nudges.length ? <p className="text-sm text-white/50">No nudges right now.</p> : null}
            </div>
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </Card>
      </div>
    </div>
  );
}
