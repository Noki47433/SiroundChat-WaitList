"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";

const trainingTiles = [
  { title: "Upload docs", detail: "Drag & drop PDFs or URLs", color: "from-brand to-amber-300" },
  { title: "Connect knowledge base", detail: "Sync Notion, Zendesk, or Intercom", color: "from-rose-400 to-orange-200" },
  { title: "Sync tickets", detail: "Import patterns from historic chats", color: "from-accent-blue to-indigo-400" }
];

const playbookItems = [
  {
    title: "Understands your universe",
    detail: "Docs, tickets, CRM, and call notes are ingested instantly so every reply lands with context."
  },
  {
    title: "Keeps humans in the loop",
    detail: "Smart routing, suggested drafts, and transcripts mean your team is always informed."
  },
  {
    title: "Learns with every conversation",
    detail: "SiroundChat improves based on outcomes, not keywords, so accuracy climbs week after week."
  },
  {
    title: "Secured for scale",
    detail: "SOC 2-ready controls, redaction, and approvals keep trust with security teams."
  }
];

const conversations = [
  { name: "Daria | OrbitCloud", tag: "Pre-sales", status: "Responding", time: "1.2s" },
  { name: "Marco | NovaCRM", tag: "Billing", status: "Resolved", time: "0.8s" },
  { name: "Fatima | Aurora", tag: "Bug report", status: "Escalated", time: "1.5s" }
];

const topics = [
  { topic: "Usage limits", count: "143" },
  { topic: "Billing updates", count: "98" },
  { topic: "Integrations", count: "87" }
];

const orbitTeams = [
  { label: "Support", color: "bg-emerald-400", metric: "72% deflection" },
  { label: "Sales", color: "bg-rose-400", metric: "+34% leads" },
  { label: "Success", color: "bg-blue-500", metric: "98 CSAT" },
  { label: "Product", color: "bg-amber-500", metric: "Top bugs 12h" },
  { label: "Ops", color: "bg-purple-400", metric: "Instant alerts" },
  { label: "Marketing", color: "bg-sky-400", metric: "Personalized upsells" }
];

const pricingHighlights = [
  { tier: "Starter", stat: "500 replies", accent: "from-amber-200 to-white" },
  { tier: "Growth", stat: "Priority AI", accent: "from-blue-200 to-white" }
];

const startupJourneys = [
  {
    title: "Launch fast",
    stat: "5-min setup",
    bullets: ["Drop-in widget + API", "Import docs & CRM instantly", "Invite teammates with roles"]
  },
  {
    title: "Learn faster",
    stat: "Live insights",
    bullets: ["Pulse CSAT + Sentiment", "Surface churn warnings", "Spot trending topics"]
  },
  {
    title: "Scale effortlessly",
    stat: "Global-ready",
    bullets: ["Auto-route to best teammate", "Layer AI + human handoffs", "Adaptive playbooks"]
  }
];

const builderBars = [
  { width: "82%", delay: 0 },
  { width: "64%", delay: 0.12 },
  { width: "74%", delay: 0.22 },
  { width: "58%", delay: 0.3 }
];

const builderPulseTransition = { repeat: Infinity, repeatType: "mirror" as const, duration: 2.4, ease: "easeInOut" };

export function HeroSpotlight() {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      className="relative overflow-hidden rounded-[32px] border border-white/40 bg-gradient-to-br from-[#fef3c7] via-white to-[#dbeafe] p-6 shadow-[0_40px_120px_rgba(15,23,42,0.25)]"
    >
      <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-amber-200 opacity-60 blur-[80px]" />
      <div className="absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-blue-200 opacity-80 blur-[90px]" />
      <div className="relative space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-soft">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
            <Image
              src="/images-logo/SiroundChatLogo.png"
              alt="SiroundChat"
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-brand-dark">SiroundChat | Spotlight</p>
            <p className="text-xs text-muted">Real-time AI chat</p>
          </div>
        </div>
        <div className="space-y-3">
          {["Understands nuance instantly", "Mirrors your tone perfectly", "Escalates with transcripts"].map((line, index) => (
            <motion.div
              key={line}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15, duration: 0.5, ease: "easeOut" }}
              className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium text-brand-dark shadow-sm"
            >
              {line}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function FeatureGlow() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/20 bg-gradient-to-br from-[#fdf2f8] via-[#fff7ed] to-[#e0f2fe] p-6 shadow-soft">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-brand/40 via-transparent to-accent-blue/40 opacity-70 blur-[120px]"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 40, ease: "linear", repeat: Infinity }}
      />
      <div className="relative space-y-4">
        {playbookItems.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-brand-dark">{item.title}</p>
            <p className="text-xs text-muted">{item.detail}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function TrainVisual() {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    setIsActive(true);
  }, []);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-gradient-to-r from-amber-300 via-white to-accent-blue opacity-80 blur-3xl" />
      <div className="relative space-y-4">
        {trainingTiles.map((tile, index) => (
          <motion.div
            key={tile.title}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={isActive ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.55, ease: "easeOut", delay: index * 0.2 }}
            className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-soft backdrop-blur"
          >
            <div className={`inline-flex items-center rounded-full bg-gradient-to-r ${tile.color} px-3 py-1 text-xs font-semibold text-white`}>
              {tile.title}
            </div>
            <p className="mt-3 text-sm text-muted">{tile.detail}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-muted">
              <span>Ready</span>
              <span className="text-brand-dark">Synced OK</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function GlobalSupportVisual() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 rounded-[2.7rem] bg-gradient-to-r from-brand/70 via-rose-200 to-accent-blue/60 blur-2xl" />
      <div className="relative rounded-[2.5rem] bg-gradient-to-r from-brand via-accent-blue to-rose-300 p-0.5 shadow-soft">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-[2.4rem] bg-white/95 p-6 backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-dark">Global inbox</p>
              <p className="text-xs text-muted">Always-on routing</p>
            </div>
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-dark">Live</span>
          </div>
          <div className="mt-6 space-y-4">
            {conversations.map((conversation) => (
              <motion.div
                key={conversation.name}
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-2xl border border-border-subtle/70 bg-white/80 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{conversation.name}</p>
                  <span className="text-xs text-muted">{conversation.time}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-dark">
                    {conversation.tag}
                  </span>
                  <span className="text-xs text-emerald-600">{conversation.status}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function AnalyticsVisual() {
  const progress = useMotionValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(progress, 97, { duration: 1.6, ease: "easeOut" });
    const unsubscribe = progress.on("change", (value) => setDisplayValue(Math.round(value)));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [progress]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-[2.8rem] bg-gradient-to-r from-accent-blue/60 via-brand-soft to-white opacity-70 blur-2xl" />
      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="relative rounded-2xl border border-transparent bg-gradient-to-br from-white/80 to-blue-50 p-6 shadow-soft backdrop-blur"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-white p-4 shadow-inner">
            <p className="text-sm font-semibold text-brand-dark">Resolution rate</p>
            <div className="mt-4 h-28">
              <svg viewBox="0 0 180 80" className="h-full w-full text-accent-blue">
                <motion.path
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  d="M0 60 L30 50 L60 55 L90 30 L120 35 L150 20 L180 25"
                  strokeDasharray="220"
                  strokeDashoffset="220"
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="lineGradient" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#A855F7" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-brand-soft/80 via-white to-blue-50 p-4 shadow-inner">
            <p className="text-sm font-semibold text-brand-dark">CSAT</p>
            <div className="mt-4 flex items-end gap-2">
              {[60, 80, 50, 90].map((value, idx) => (
                <div key={idx} className="flex-1">
                  <motion.div
                    animate={{ height: [`${value - 10}%`, `${value}%`, `${value - 10}%`] }}
                    transition={{ duration: 3 + idx, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-t-full bg-gradient-to-t from-brand to-accent-blue"
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-2xl font-semibold text-brand-dark">{displayValue}%</p>
            <p className="text-xs text-muted">+12 pts vs last month</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/40 bg-white/80 p-4 backdrop-blur">
          <p className="text-sm font-semibold text-brand-dark">Top topics</p>
          <div className="mt-4 space-y-3 text-sm">
            {topics.map((item, index) => (
              <motion.div
                key={item.topic}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: index * 0.05 }}
                className="flex items-center justify-between"
              >
                <span className="text-muted">{item.topic}</span>
                <span className="font-semibold text-ink">{item.count}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function UseCasesOrbit() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/40 bg-gradient-to-b from-[#ecfeff] via-white to-[#fdf2f8] p-8 shadow-soft">
      <motion.div className="absolute inset-0" animate={{ rotate: [0, 360] }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}>
        <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60" />
        <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
      </motion.div>
      <div className="relative flex h-52 items-center justify-center">
        <div className="rounded-3xl border border-white/70 bg-white/85 px-6 py-5 text-center shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">One AI brain</p>
          <p className="text-2xl font-semibold text-brand-dark">Every touchpoint</p>
          <p className="text-xs text-muted">Shared context + routing rules</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left text-xs font-semibold text-brand-dark">
            <div>
              <p>Playbooks</p>
              <p className="text-ink">120+</p>
            </div>
            <div>
              <p>Integrations</p>
              <p className="text-ink">40+</p>
            </div>
          </div>
        </div>
        {orbitTeams.map((team, index) => {
          const rotation = index * (360 / orbitTeams.length);
          return (
            <motion.div
              key={team.label}
              className="absolute flex flex-col items-center gap-1 rounded-2xl bg-white/80 px-3 py-2 text-[11px] font-semibold text-ink shadow-sm"
              style={{
                transform: `rotate(${rotation}deg) translate(0, -150px) rotate(-${rotation}deg)`
              }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 6 + index, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${team.color}`} />
                <span>{team.label}</span>
              </div>
              <span className="text-[10px] font-medium text-muted">{team.metric}</span>
            </motion.div>
          );
        })}
      </div>
      <div className="relative mt-6 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Customer-ready support",
            detail: "Drafts + transcripts drop directly into Zendesk, Intercom, or Salesforce Service Cloud."
          },
          {
            title: "Revenue-aware sales",
            detail: "Qualify visitors by persona and sync into HubSpot or Salesforce with lead notes."
          },
          {
            title: "Product signals",
            detail: "Aggregate feature asks, bug reports, and roadmap votes with zero manual tagging."
          }
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-white/60 bg-white/80 p-4 text-xs text-muted">
            <p className="text-sm font-semibold text-brand-dark">{card.title}</p>
            <p>{card.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeveloperConsoleCard() {
  const codeLines = [
    "import { SiroundChatClient } from '@siroundchat/js'",
    "const client = new SiroundChatClient({ apiKey: 'env' })",
    "",
    "export async function POST(req) {",
    "  const { message, user } = await req.json()",
    "  return client.chat.reply({",
    "    message,",
    "    userId: user.id,",
    "    routing: 'global',",
    "  })",
    "}"
  ];
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      className="overflow-hidden rounded-[28px] border border-white/20 bg-[#020617] p-6 shadow-[0_35px_110px_rgba(2,6,23,0.8)]"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-red-500" />
        <span className="h-3 w-3 rounded-full bg-yellow-400" />
        <span className="h-3 w-3 rounded-full bg-green-500" />
      </div>
      <div className="space-y-1 font-mono text-xs text-white/80">
        {codeLines.map((line, index) => (
          <motion.div
            key={`${line}-${index}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            {line || "\u00A0"}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function PricingWave() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-br from-[#fff7ed] via-white to-[#e0f2ff] p-6 shadow-soft">
      <motion.div
        className="absolute inset-x-0 -bottom-10 h-32 bg-gradient-to-r from-brand/40 to-accent-blue/40 blur-3xl"
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      <div className="relative grid gap-4 md:grid-cols-2">
        {pricingHighlights.map((tier) => (
          <div key={tier.tier} className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">{tier.tier}</p>
            <p className="text-2xl font-semibold text-brand-dark">{tier.stat}</p>
            <div className={`mt-4 rounded-2xl bg-gradient-to-r ${tier.accent} px-4 py-2 text-xs font-semibold text-ink`}>
              Guaranteed accuracy
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StartupsConstellation() {
  const milestoneMetrics = [
    { label: "Messages handled", value: "8.5M" },
    { label: "Markets launched", value: "42" },
    { label: "Avg. response", value: "0.9s" }
  ];

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/20 bg-gradient-to-br from-[#f5f3ff] via-white to-[#cffafe] p-8 shadow-soft">
      <motion.div className="absolute inset-0" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.6),transparent_70%)]" />
      </motion.div>
      <div className="relative grid gap-4 md:grid-cols-3">
        {startupJourneys.map((journey, index) => (
          <motion.div
            key={journey.title}
            className="space-y-3 rounded-2xl border border-white/70 bg-white/85 p-5 shadow-soft"
            animate={{ y: [0, index % 2 === 0 ? -4 : 4, 0] }}
            transition={{ duration: 6 + index, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand">{journey.title}</p>
              <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-semibold text-brand-dark">{journey.stat}</span>
            </div>
            <ul className="space-y-2 text-xs text-muted">
              {journey.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm">
        {milestoneMetrics.map((metric) => (
          <div key={metric.label}>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{metric.label}</p>
            <p className="text-lg font-semibold text-brand-dark">{metric.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.3em] text-muted">
        A constellation of teams scaling with SiroundChat
      </p>
    </div>
  );
}

export function NoWebsiteVisual() {
  return (
    <div className="relative">
      <div className="absolute -left-4 -top-6 h-20 w-20 rounded-3xl bg-gradient-to-br from-[#F7C948] to-amber-300 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-white via-[#FFF8E9] to-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 shadow-inner">
          <div className="flex items-center gap-2">
            {["#F7C948", "#0F172A", "#3B82F6"].map((color) => (
              <span key={color} className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            ))}
          </div>
          <span className="rounded-full bg-[#F7C948]/15 px-3 py-1 text-xs font-semibold text-brand-dark">AI Builder</span>
        </div>
        <div className="space-y-3 rounded-2xl bg-white/90 p-4 text-brand-dark shadow-inner">
          <div className="flex items-center justify-between">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={builderPulseTransition}
              className="rounded-full bg-[#F7C948]/15 px-3 py-1 text-xs font-semibold text-brand-dark"
            >
              Generating hero section
            </motion.div>
            <motion.span
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, repeatType: "mirror", duration: 1.8 }}
              className="text-xs font-semibold text-muted"
            >
              Live preview
            </motion.span>
          </div>
          <div className="space-y-2 rounded-2xl border border-dashed border-[#F7C948]/30 bg-[#FFF7E6] p-3 shadow-inner">
            <div className="h-2 w-24 rounded-full bg-[#F7C948]/70" />
            <div className="h-8 rounded-xl bg-white/90 shadow-inner" />
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="h-16 rounded-xl bg-white/80 shadow-inner" />
              <div className="h-16 rounded-xl bg-white/80 shadow-inner" />
            </div>
          </div>
          <div className="space-y-2 rounded-2xl bg-white/90 p-3 shadow-inner">
            {builderBars.map((bar) => (
              <motion.div
                key={bar.width}
                initial={{ width: bar.width, opacity: 0.4 }}
                animate={{ width: bar.width, opacity: [0.4, 1, 0.4] }}
                transition={{ ...builderPulseTransition, delay: bar.delay }}
                className="h-3 rounded-full bg-[#F7C948]/60"
              />
            ))}
          </div>
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, repeatType: "mirror", duration: 1.6, ease: "easeInOut" }}
            className="flex flex-wrap gap-2"
          >
            {["Navbar", "Hero", "CTA", "About", "Contact"].map((token) => (
              <span
                key={token}
                className="rounded-full border border-[#F7C948]/30 bg-white px-3 py-1 text-xs font-semibold text-brand-dark shadow-sm"
              >
                {token}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
