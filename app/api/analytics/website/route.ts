import { NextResponse } from "next/server";
import { z } from "zod";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/config/auth";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { listOwnedBusinessIds } from "@/lib/builder/site-access";
import { getBusinessEntitlementAccess } from "@/lib/server/billing-access";

export const runtime = "nodejs";

const RangeSchema = z.enum(["7d", "30d", "90d"]);
const MapModeSchema = z.enum(["visitors", "leads"]);
const SiteIdSchema = z.string().uuid().optional();

const RANGE_DAYS: Record<z.infer<typeof RangeSchema>, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90
};

const DAY_MS = 24 * 60 * 60 * 1000;

type OverviewMetric = { value: number; deltaPct: number };

type WebsiteAnalyticsResponse = {
  range: z.infer<typeof RangeSchema>;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  overview: {
    visitors: OverviewMetric;
    chatsStarted: OverviewMetric;
    leads: OverviewMetric;
    ctaClicks: OverviewMetric;
  };
  overviewSeries: {
    labels: string[];
    visitors: number[];
    chatsStarted: number[];
    leads: number[];
    ctaClicks: number[];
  };
  worldMap: {
    mode: z.infer<typeof MapModeSchema>;
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
  nudges: Array<{
    id: string;
    title: string;
    body: string;
    ctaLabel?: string;
    ctaHref?: string;
  }>;
};

type WebsiteEventRow = {
  event_type: string | null;
  channel: string | null;
  cta_type: string | null;
  lead_type: string | null;
  page_path: string | null;
  page_title: string | null;
  session_id: string | null;
  country_code: string | null;
  occurred_at: string | null;
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const calcDelta = (current: number, previous: number) =>
  Math.round(((current - previous) / Math.max(previous, 1)) * 100);

const toHour = (date: string, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone });
  const hour = Number(formatter.format(new Date(date)));
  return Number.isNaN(hour) ? 0 : Math.max(0, Math.min(23, hour));
};

const buildHourlyBuckets = (events: WebsiteEventRow[], timeZone: string) => {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, visitors: 0, interactions: 0, leads: 0 }));

  events.forEach((event) => {
    if (!event.occurred_at) return;
    const hour = toHour(event.occurred_at, timeZone);
    const bucket = hourly[hour];
    if (!bucket) return;

    if (event.event_type === "page_view") {
      bucket.visitors += 1;
    }
    if (event.event_type === "lead_submitted") {
      bucket.leads += 1;
      bucket.interactions += 1;
    }
    if (event.event_type === "chat_started" || event.event_type === "cta_click") {
      bucket.interactions += 1;
    }
  });

  return hourly;
};

const findBestWindow = (hourly: Array<{ hour: number; interactions: number }>, windowSize = 3) => {
  let bestStart = 0;
  let bestSum = -1;

  for (let start = 0; start < 24; start += 1) {
    let sum = 0;
    for (let offset = 0; offset < windowSize; offset += 1) {
      const idx = (start + offset) % 24;
      sum += hourly[idx]?.interactions ?? 0;
    }
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = start;
    }
  }

  return { startHour: bestStart, endHour: (bestStart + windowSize) % 24 };
};

const buildDailyOverviewSeries = (
  events: WebsiteEventRow[],
  start: Date,
  days: number,
  timeZone: string
) => {
  const keyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone });
  const labelFormatter = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "2-digit" });
  const dayKeys: string[] = [];
  const labels: string[] = [];
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start.getTime() + index * DAY_MS);
    dayKeys.push(keyFormatter.format(date));
    labels.push(labelFormatter.format(date));
  }

  const visitorsByDay = new Map<string, Set<string>>();
  const chatsByDay = new Map<string, number>();
  const leadsByDay = new Map<string, number>();
  const ctaByDay = new Map<string, number>();

  events.forEach((event) => {
    if (!event.occurred_at) return;
    const key = keyFormatter.format(new Date(event.occurred_at));
    if (event.event_type === "page_view") {
      if (!event.session_id) return;
      if (!visitorsByDay.has(key)) visitorsByDay.set(key, new Set());
      visitorsByDay.get(key)?.add(event.session_id);
    }
    if (event.event_type === "chat_started") {
      chatsByDay.set(key, (chatsByDay.get(key) ?? 0) + 1);
    }
    if (event.event_type === "lead_submitted") {
      leadsByDay.set(key, (leadsByDay.get(key) ?? 0) + 1);
    }
    if (event.event_type === "cta_click") {
      ctaByDay.set(key, (ctaByDay.get(key) ?? 0) + 1);
    }
  });

  return {
    labels,
    visitors: dayKeys.map((key) => visitorsByDay.get(key)?.size ?? 0),
    chatsStarted: dayKeys.map((key) => chatsByDay.get(key) ?? 0),
    leads: dayKeys.map((key) => leadsByDay.get(key) ?? 0),
    ctaClicks: dayKeys.map((key) => ctaByDay.get(key) ?? 0)
  };
};

const buildDemoResponse = (businessId: string, range: z.infer<typeof RangeSchema>, mode: z.infer<typeof MapModeSchema>) => {
  const seed = hashString(`${businessId}:${range}`);
  const rand = mulberry32(seed);
  const days = RANGE_DAYS[range];

  const basePerDay = 35 + rand() * 25;
  const visitors = Math.round(basePerDay * days);
  const chatsStarted = Math.round(visitors * (0.15 + rand() * 0.12));
  const leads = Math.max(12, Math.round(visitors * (0.03 + rand() * 0.03)));
  const ctaClicks = Math.round(visitors * (0.08 + rand() * 0.08));

  const prevMultiplier = 0.7 + rand() * 0.6;
  const prevVisitors = Math.round(visitors * prevMultiplier);
  const prevChats = Math.round(chatsStarted * (0.75 + rand() * 0.5));
  const prevLeads = Math.round(leads * (0.7 + rand() * 0.6));
  const prevCta = Math.round(ctaClicks * (0.7 + rand() * 0.6));

  const countries = [
    { code: "US", weight: 0.2 },
    { code: "DE", weight: 0.12 },
    { code: "CH", weight: 0.09 },
    { code: "GB", weight: 0.08 },
    { code: "IT", weight: 0.07 },
    { code: "FR", weight: 0.06 },
    { code: "AL", weight: 0.05 },
    { code: "XK", weight: 0.05 },
    { code: "CA", weight: 0.04 },
    { code: null, weight: 0.04 }
  ];

  const mapTotal = mode === "leads" ? leads : visitors;
  const worldMap = {
    mode,
    countries: countries.map((country) => ({
      countryCode: country.code,
      value: Math.max(1, Math.round(mapTotal * country.weight * (0.8 + rand() * 0.4)))
    }))
  };

  const pages = [
    { pagePath: "/", pageTitle: "Home", ratio: 0.32 },
    { pagePath: "/services", pageTitle: "Services", ratio: 0.2 },
    { pagePath: "/contact", pageTitle: "Contact", ratio: 0.16 },
    { pagePath: "/menu", pageTitle: "Menu", ratio: 0.12 },
    { pagePath: "/about", pageTitle: "About", ratio: 0.1 },
    { pagePath: "/pricing", pageTitle: "Pricing", ratio: 0.1 }
  ];

  const pageRows = pages.map((page) => {
    const pageVisitors = Math.max(12, Math.round(visitors * page.ratio));
    const pageLeads = Math.max(1, Math.round(leads * page.ratio * (0.8 + rand() * 0.5)));
    const pageChats = Math.max(2, Math.round(chatsStarted * page.ratio * (0.8 + rand() * 0.4)));
    const pageCta = Math.max(1, Math.round(ctaClicks * page.ratio * (0.8 + rand() * 0.4)));
    return {
      pagePath: page.pagePath,
      pageTitle: page.pageTitle,
      visitors: pageVisitors,
      leads: pageLeads,
      chatsStarted: pageChats,
      ctaClicks: pageCta
    };
  });

  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const distance = Math.abs(hour - 18);
    const peakBoost = Math.max(0, 1 - distance / 6);
    const base = 2 + rand() * 4;
    const interactions = Math.round(base + peakBoost * (8 + rand() * 8));
    const leadsHour = Math.round(interactions * (0.15 + rand() * 0.1));
    return {
      hour,
      visitors: Math.round(interactions * (2 + rand() * 1.5)),
      interactions,
      leads: leadsHour
    };
  });

  const labelFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", timeZone: "UTC" });
  const demoStart = new Date(Date.now() - (days - 1) * DAY_MS);
  const labels = Array.from({ length: days }, (_, index) =>
    labelFormatter.format(new Date(demoStart.getTime() + index * DAY_MS))
  );
  const buildSeries = (total: number) => {
    const base = total / days;
    return Array.from({ length: days }, () => Math.max(0, Math.round(base * (0.6 + rand() * 0.8))));
  };
  const overviewSeries = {
    labels,
    visitors: buildSeries(visitors),
    chatsStarted: buildSeries(chatsStarted),
    leads: buildSeries(leads),
    ctaClicks: buildSeries(ctaClicks)
  };

  const bestWindow = findBestWindow(hourly);

  const leadsByChannel = {
    chatbot: Math.round(leads * (0.55 + rand() * 0.2)),
    form: Math.max(1, leads - Math.round(leads * (0.55 + rand() * 0.2)))
  };

  const interactionsByChannel = {
    chatbot: Math.round((chatsStarted + leadsByChannel.chatbot) * (0.9 + rand() * 0.3)),
    website: Math.round((ctaClicks + leadsByChannel.form) * (0.9 + rand() * 0.3))
  };

  const nudges = [
    {
      id: "nudge-peak",
      title: "Evening traffic is your sweet spot",
      body: "Most visitors show up between 17:00-20:00. Keep someone on standby or schedule fast replies in that window."
    },
    {
      id: "nudge-chat",
      title: "Your chatbot closes the deal",
      body: "Chat leads are outpacing form leads. Consider moving the lead question earlier in the chat flow.",
      ctaLabel: "Tune chatbot",
      ctaHref: "/dashboard/settings"
    },
    {
      id: "nudge-cta",
      title: "Top page needs a sharper CTA",
      body: "Your main page gets the most traffic. Add a stronger call-to-action above the fold to drive more contacts."
    }
  ];

  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    range,
    start: start.toISOString(),
    end: now.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: start.toISOString(),
    overview: {
      visitors: { value: visitors, deltaPct: calcDelta(visitors, prevVisitors) },
      chatsStarted: { value: chatsStarted, deltaPct: calcDelta(chatsStarted, prevChats) },
      leads: { value: leads, deltaPct: calcDelta(leads, prevLeads) },
      ctaClicks: { value: ctaClicks, deltaPct: calcDelta(ctaClicks, prevCta) }
    },
    overviewSeries,
    worldMap,
    pages: pageRows,
    peakTimes: { hourly, bestWindow },
    channelSplit: { leadsByChannel, interactionsByChannel },
    nudges
  } satisfies WebsiteAnalyticsResponse;
};

const buildNudges = (params: {
  visitors: number;
  leads: number;
  ctaClicks: number;
  chatsStarted: number;
  pages: WebsiteAnalyticsResponse["pages"];
  bestWindow: { startHour: number; endHour: number; total: number };
  totalInteractions: number;
  leadsByChannel: { chatbot: number; form: number };
}) => {
  const nudges: WebsiteAnalyticsResponse["nudges"] = [];

  if (params.leads === 0 && params.visitors > 50) {
    nudges.push({
      id: "no-leads",
      title: "Visitors are landing but not converting",
      body: "You're getting visitors but no leads. Add a WhatsApp button or a short contact form on your top page.",
      ctaLabel: "Update CTAs",
      ctaHref: "/dashboard/builder"
    });
  }

  const topPage = params.pages[0];
  if (topPage && topPage.visitors > 80) {
    const ctaRate = topPage.ctaClicks / Math.max(topPage.visitors, 1);
    if (ctaRate < 0.03) {
      nudges.push({
        id: "cta-low",
        title: "Your top page needs a stronger CTA",
        body: `People view ${topPage.pagePath} but rarely reach out. Add a bold CTA near the top to guide them.`,
        ctaLabel: "Edit page",
        ctaHref: "/dashboard/builder"
      });
    }
  }

  if (params.totalInteractions > 0 && params.bestWindow.total / params.totalInteractions >= 0.35) {
    nudges.push({
      id: "peak-window",
      title: "Most activity clusters in a short window",
      body: `Your busiest time is ${params.bestWindow.startHour}:00-${params.bestWindow.endHour}:00. Make sure responses are fast in that window.`
    });
  }

  if (params.leadsByChannel.chatbot > params.leadsByChannel.form && params.leadsByChannel.chatbot >= 5) {
    nudges.push({
      id: "chatbot-leads",
      title: "Your chatbot is your best salesperson",
      body: "Chat leads are outperforming form leads. Consider asking for contact info earlier in the chat.",
      ctaLabel: "Tune chatbot",
      ctaHref: "/dashboard/settings"
    });
  }

  return nudges.slice(0, 3);
};

const buildWorldMap = (events: WebsiteEventRow[], mode: z.infer<typeof MapModeSchema>) => {
  if (mode === "leads") {
    const counts = new Map<string | null, number>();
    events
      .filter((event) => event.event_type === "lead_submitted")
      .forEach((event) => {
        const key = event.country_code ?? null;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    return Array.from(counts.entries()).map(([countryCode, value]) => ({ countryCode, value }));
  }

  const sessionsByCountry = new Map<string | null, Set<string>>();
  events
    .filter((event) => event.event_type === "page_view")
    .forEach((event) => {
      const key = event.country_code ?? null;
      const session = event.session_id ?? "";
      if (!sessionsByCountry.has(key)) {
        sessionsByCountry.set(key, new Set());
      }
      if (session) {
        sessionsByCountry.get(key)?.add(session);
      }
    });

  return Array.from(sessionsByCountry.entries()).map(([countryCode, sessions]) => ({
    countryCode,
    value: sessions.size
  }));
};

const distinctSessionCount = (events: WebsiteEventRow[], predicate: (event: WebsiteEventRow) => boolean) => {
  const sessions = new Set<string>();
  events.filter(predicate).forEach((event) => {
    if (event.session_id) sessions.add(event.session_id);
  });
  return sessions.size;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") ?? "7d";
  const modeParam = url.searchParams.get("mode") ?? "visitors";
  const siteParam = url.searchParams.get("siteId") ?? undefined;
  const rangeParsed = RangeSchema.safeParse(rangeParam);
  const modeParsed = MapModeSchema.safeParse(modeParam);

  const range = rangeParsed.success ? rangeParsed.data : "7d";
  const mode = modeParsed.success ? modeParsed.data : "visitors";
  const siteParsed = SiteIdSchema.safeParse(siteParam);
  const siteId = siteParsed.success ? siteParsed.data : undefined;

  const demoEnabled =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ANALYTICS_DEMO === "1" &&
    url.searchParams.get("demo") === "1";

  if (isAuthDisabled()) {
    return NextResponse.json(buildDemoResponse("demo", range, mode));
  }

  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownedBusinessIds = await listOwnedBusinessIds(user.id);
  if (!ownedBusinessIds.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (demoEnabled) {
    return NextResponse.json(buildDemoResponse(ownedBusinessIds[0], range, mode));
  }

  const db = getSupabaseAdminClientIfAvailable() as any;
  if (!db) {
    console.error("[WEBSITE_ANALYTICS_CONFIG_MISSING]", { userId: user.id, siteId });
    return NextResponse.json({ error: "Website analytics are unavailable right now." }, { status: 500 });
  }
  const days = RANGE_DAYS[range];
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

  const startIso = start.toISOString();
  const endIso = now.toISOString();
  const prevStartIso = prevStart.toISOString();
  const prevEndIso = startIso;

  let timeZone = "UTC";
  let selectedBusinessId = ownedBusinessIds[0];

  if (siteId) {
    const { data: siteRow } = await db
      .from("builder_sites")
      .select("id, business_id")
      .eq("id", siteId)
      .maybeSingle();

    if (!siteRow?.id || !ownedBusinessIds.includes(siteRow.business_id as string)) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    selectedBusinessId = siteRow.business_id as string;
  }

  const { data: business } = await db
    .from("businesses")
    .select("timezone")
    .eq("id", selectedBusinessId)
    .maybeSingle();

  const billingAccess = await getBusinessEntitlementAccess(selectedBusinessId, "advanced_analytics");
  if (!billingAccess.allowed) {
    return NextResponse.json({ error: "Advanced analytics are not available on the current plan" }, { status: 403 });
  }

  timeZone = (business?.timezone as string | null) ?? "UTC";

  let currentQuery = db
    .from("website_analytics_events")
    .select("event_type, channel, cta_type, lead_type, page_path, page_title, session_id, country_code, occurred_at")
    .eq("business_id", selectedBusinessId)
    .gte("occurred_at", startIso)
    .lt("occurred_at", endIso);

  let prevQuery = db
    .from("website_analytics_events")
    .select("event_type, channel, session_id")
    .eq("business_id", selectedBusinessId)
    .gte("occurred_at", prevStartIso)
    .lt("occurred_at", prevEndIso);

  if (siteId) {
    currentQuery = currentQuery.eq("site_id", siteId);
    prevQuery = prevQuery.eq("site_id", siteId);
  }

  const { data: currentEvents } = await currentQuery;

  const { data: prevEvents } = await prevQuery;

  const events = (currentEvents ?? []) as WebsiteEventRow[];
  const previous = (prevEvents ?? []) as WebsiteEventRow[];

  const visitors = distinctSessionCount(events, (event) => event.event_type === "page_view");
  const chatsStarted = events.filter((event) => event.event_type === "chat_started").length;
  const leads = events.filter((event) => event.event_type === "lead_submitted").length;
  const ctaClicks = events.filter((event) => event.event_type === "cta_click").length;

  const prevVisitors = distinctSessionCount(previous, (event) => event.event_type === "page_view");
  const prevChats = previous.filter((event) => event.event_type === "chat_started").length;
  const prevLeads = previous.filter((event) => event.event_type === "lead_submitted").length;
  const prevCta = previous.filter((event) => event.event_type === "cta_click").length;

  const worldMap = {
    mode,
    countries: buildWorldMap(events, mode)
  };

  const pagesMap = new Map<
    string,
    { pageTitle?: string | null; visitors: Set<string>; leads: number; chatsStarted: number; ctaClicks: number }
  >();

  events.forEach((event) => {
    const path = event.page_path ?? "/";
    if (!pagesMap.has(path)) {
      pagesMap.set(path, {
        pageTitle: event.page_title ?? null,
        visitors: new Set<string>(),
        leads: 0,
        chatsStarted: 0,
        ctaClicks: 0
      });
    }

    const entry = pagesMap.get(path);
    if (!entry) return;

    if (event.event_type === "page_view" && event.session_id) {
      entry.visitors.add(event.session_id);
    }
    if (event.event_type === "lead_submitted") {
      entry.leads += 1;
    }
    if (event.event_type === "chat_started") {
      entry.chatsStarted += 1;
    }
    if (event.event_type === "cta_click") {
      entry.ctaClicks += 1;
    }
  });

  const pages = Array.from(pagesMap.entries())
    .map(([pagePath, data]) => ({
      pagePath,
      pageTitle: data.pageTitle ?? null,
      visitors: data.visitors.size,
      leads: data.leads,
      chatsStarted: data.chatsStarted,
      ctaClicks: data.ctaClicks
    }))
    .sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      return b.visitors - a.visitors;
    })
    .slice(0, 6);

  const hourly = buildHourlyBuckets(events, timeZone);
  const bestWindow = findBestWindow(hourly);

  const leadsByChannel = {
    chatbot: events.filter((event) => event.event_type === "lead_submitted" && event.channel === "chatbot").length,
    form: events.filter((event) => event.event_type === "lead_submitted" && event.channel === "form").length
  };

  const interactionsByChannel = {
    chatbot:
      events.filter((event) => event.event_type === "chat_started" && event.channel === "chatbot").length +
      leadsByChannel.chatbot,
    website: events.filter((event) => event.event_type === "cta_click" && event.channel === "website").length + leadsByChannel.form
  };

  const totalInteractions = hourly.reduce((sum, bucket) => sum + bucket.interactions, 0);
  const bestWindowTotal = hourly
    .filter((bucket) => {
      const start = bestWindow.startHour;
      const end = bestWindow.endHour;
      if (start < end) {
        return bucket.hour >= start && bucket.hour < end;
      }
      return bucket.hour >= start || bucket.hour < end;
    })
    .reduce((sum, bucket) => sum + bucket.interactions, 0);

  const nudges = buildNudges({
    visitors,
    leads,
    ctaClicks,
    chatsStarted,
    pages,
    bestWindow: { ...bestWindow, total: bestWindowTotal },
    totalInteractions,
    leadsByChannel
  });

  const response: WebsiteAnalyticsResponse = {
    range,
    start: startIso,
    end: endIso,
    prevStart: prevStartIso,
    prevEnd: prevEndIso,
    overview: {
      visitors: { value: visitors, deltaPct: calcDelta(visitors, prevVisitors) },
      chatsStarted: { value: chatsStarted, deltaPct: calcDelta(chatsStarted, prevChats) },
      leads: { value: leads, deltaPct: calcDelta(leads, prevLeads) },
      ctaClicks: { value: ctaClicks, deltaPct: calcDelta(ctaClicks, prevCta) }
    },
    overviewSeries: buildDailyOverviewSeries(events, start, days, timeZone),
    worldMap,
    pages,
    peakTimes: { hourly, bestWindow },
    channelSplit: { leadsByChannel, interactionsByChannel },
    nudges
  };

  return NextResponse.json(response);
}
