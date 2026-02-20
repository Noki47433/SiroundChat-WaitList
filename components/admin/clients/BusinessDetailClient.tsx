"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, PhoneCall } from "lucide-react";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UsageLineChart } from "@/components/admin/Charts/UsageLineChart";
import { UsageStackedChart } from "@/components/admin/Charts/UsageStackedChart";
import { CostTrendChart } from "@/components/admin/Charts/CostTrendChart";
import { useRealtimeTable } from "@/hooks/useRealtime";
import type { BusinessDetailData } from "@/lib/admin/metrics";

const eur = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const usd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export function BusinessDetailClient({ businessId, initialData }: { businessId: string; initialData: BusinessDetailData }) {
  const [data, setData] = useState(initialData);
  const [conversationSearch, setConversationSearch] = useState("");
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callNote, setCallNote] = useState("Congrats on the recent performance. Review upsell plan and renewal date.");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/business/${businessId}/metrics?range=${data.range}`, {
      cache: "no-store"
    });
    if (!response.ok) return;
    const next = (await response.json()) as BusinessDetailData;
    setData(next);
  }, [businessId, data.range]);

  useRealtimeTable({
    table: "messages",
    filter: `business_id=eq.${businessId}`,
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 15000
  });

  useRealtimeTable({
    table: "leads",
    filter: `business_id=eq.${businessId}`,
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 15000
  });

  useRealtimeTable({
    table: "business_metrics_daily",
    filter: `business_id=eq.${businessId}`,
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 20000
  });

  const filteredConversations = useMemo(() => {
    const text = conversationSearch.trim().toLowerCase();
    if (!text) return data.conversations;
    return data.conversations.filter((conversation) => {
      return (
        conversation.id.toLowerCase().includes(text) ||
        conversation.visitorId?.toLowerCase().includes(text) ||
        conversation.latestMessage?.toLowerCase().includes(text)
      );
    });
  }, [conversationSearch, data.conversations]);

  const unprofitable = data.snapshot.aiCostUsd > data.business.mrrEur && data.business.mrrEur > 0;

  return (
    <Tabs defaultValue="snapshot">
      <TabsList>
        <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
        <TabsTrigger value="usage">Usage</TabsTrigger>
        <TabsTrigger value="leads">Leads</TabsTrigger>
        <TabsTrigger value="costs">Costs</TabsTrigger>
        <TabsTrigger value="conversations">Conversations</TabsTrigger>
      </TabsList>

      <TabsContent value="snapshot">
        <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
          <GlassCard accent="green">
            <p className="text-sm font-semibold text-[var(--adm-text)]">Business Snapshot</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/55">Plan</p>
                <p className="mt-1 text-sm text-white">{data.business.plan}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/55">Status</p>
                <p className="mt-1 text-sm text-white">{data.business.status}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/55">MRR</p>
                <p className="mt-1 text-sm text-white">{eur(data.business.mrrEur)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/55">Phone</p>
                <p className="mt-1 text-sm text-white">{data.business.phone ?? "-"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/55">Website</p>
                <p className="mt-1 text-sm text-white">{data.business.websiteUrl ?? "-"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/55">Created</p>
                <p className="mt-1 text-sm text-white">{new Date(data.business.createdAt).toLocaleDateString("en-US")}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard accent="blue">
            <p className="text-sm font-semibold text-[var(--adm-text)]">Quick Actions</p>
            <div className="mt-3 space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-start border border-white/10 bg-white/[0.04]"
                onClick={() => setCallModalOpen(true)}
              >
                Congratulate
              </Button>
              <Button variant="secondary" className="w-full justify-start border border-amber-300/25 bg-amber-500/10 text-amber-100">
                Mark at risk
              </Button>
              <Link href="/admin/conversations" className="block">
                <Button variant="secondary" className="w-full justify-start border border-white/10 bg-white/[0.04]">
                  Open latest conversation
                </Button>
              </Link>
              {data.business.phone ? (
                <a href={`tel:${data.business.phone}`}>
                  <Button variant="secondary" className="w-full justify-start border border-white/10 bg-white/[0.04]">
                    <PhoneCall className="mr-2 h-4 w-4" />
                    Call
                  </Button>
                </a>
              ) : null}
            </div>
          </GlassCard>
        </div>
        <Dialog open={callModalOpen} onClose={() => setCallModalOpen(false)} title="Congratulate Business">
          <div className="space-y-3">
            <p className="text-xs text-white/70">
              Use this note before calling <span className="text-white">{data.business.name}</span>.
            </p>
            <Textarea
              value={callNote}
              onChange={(event) => setCallNote(event.target.value)}
              className="min-h-[120px] border-white/10 bg-white/[0.03] text-white"
            />
            {data.business.phone ? (
              <a href={`tel:${data.business.phone}`}>
                <Button variant="secondary" className="w-full border border-white/10 bg-white/[0.04]">
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Call {data.business.phone}
                </Button>
              </a>
            ) : null}
          </div>
        </Dialog>
      </TabsContent>

      <TabsContent value="usage">
        <div className="space-y-4">
          <GlassCard accent="green">
            <p className="text-sm font-semibold text-[var(--adm-text)]">Messages / Day</p>
            <p className="text-xs text-[var(--adm-muted)]">Message throughput and lead capture trend</p>
            <div className="mt-3">
              <UsageLineChart data={data.usageSeries.map((item) => ({ day: item.day, messages: item.messages, leads: item.leads }))} />
            </div>
          </GlassCard>

          <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
            <GlassCard accent="blue">
              <p className="text-sm font-semibold text-[var(--adm-text)]">AI vs Human</p>
              <p className="text-xs text-[var(--adm-muted)]">Stacked message split</p>
              <div className="mt-3">
                <UsageStackedChart
                  data={data.usageSeries.map((item) => ({ day: item.day, aiMessages: item.aiMessages, humanMessages: item.humanMessages }))}
                />
              </div>
            </GlassCard>

            <GlassCard accent="green">
              <p className="text-sm font-semibold text-[var(--adm-text)]">Response & Intents</p>
              <div className="mt-3 space-y-2 text-sm text-white/85">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs text-white/55">Avg response time</p>
                  <p className="mt-1">{data.snapshot.responseMinutes ? `${data.snapshot.responseMinutes} min` : "N/A"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs text-white/55">Top intents</p>
                  <div className="mt-1 space-y-1 text-xs">
                    {data.snapshot.topLeadTypes.length ? (
                      data.snapshot.topLeadTypes.map((intent) => (
                        <div key={intent.name} className="flex justify-between">
                          <span>{intent.name}</span>
                          <span>{intent.value}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-white/60">No intent data yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="leads">
        <GlassCard accent="green">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Lead Type</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.leads.length ? (
                data.leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>{lead.name ?? "-"}</TableCell>
                    <TableCell>{lead.leadType ?? "-"}</TableCell>
                    <TableCell>{lead.phone ?? "-"}</TableCell>
                    <TableCell>{lead.email ?? "-"}</TableCell>
                    <TableCell>{new Date(lead.createdAt).toLocaleString("en-US")}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-white/55">
                    No leads yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </GlassCard>
      </TabsContent>

      <TabsContent value="costs">
        <div className="space-y-4">
          {unprofitable ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
              <p className="inline-flex items-center gap-1 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Unprofitable warning
              </p>
              <p className="mt-1 text-xs">Current AI cost exceeds MRR for this window.</p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <GlassCard accent="blue">
              <p className="text-xs text-white/55">Total AI Cost</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--adm-text)]">{usd(data.snapshot.aiCostUsd)}</p>
            </GlassCard>
            <GlassCard accent="green">
              <p className="text-xs text-white/55">Cost / Conversation</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--adm-text)]">{usd(data.snapshot.avgCostPerConversation)}</p>
            </GlassCard>
            <GlassCard accent="warning">
              <p className="text-xs text-white/55">MRR</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--adm-text)]">{eur(data.business.mrrEur)}</p>
            </GlassCard>
          </div>

          <GlassCard accent="blue">
            <p className="text-sm font-semibold text-[var(--adm-text)]">Tokens & Cost Trend</p>
            <div className="mt-3">
              <CostTrendChart
                data={data.usageSeries.map((item) => ({
                  day: item.day,
                  cost: item.cost,
                  tokensIn: item.tokensIn,
                  tokensOut: item.tokensOut
                }))}
              />
            </div>
          </GlassCard>
        </div>
      </TabsContent>

      <TabsContent value="conversations">
        <GlassCard accent="blue">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--adm-text)]">Transcript Viewer</p>
            <Input
              placeholder="Search conversation id or message"
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              className="h-9 max-w-xs border-white/10 bg-white/[0.02] text-white placeholder:text-white/35"
            />
          </div>

          <div className="space-y-2">
            {filteredConversations.length ? (
              filteredConversations.map((conversation) => (
                <div key={conversation.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white">{conversation.id.slice(0, 8)} • {conversation.status}</p>
                    <p className="text-xs text-white/50">{new Date(conversation.lastMessageAt).toLocaleString("en-US")}</p>
                  </div>
                  <p className="mt-1 text-xs text-white/65">Visitor: {conversation.visitorId ?? "anonymous"}</p>
                  <p className="mt-2 text-sm text-white/80">{conversation.latestMessage ?? "No message in window."}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-white/55">No conversations match the search.</p>
            )}
          </div>
        </GlassCard>
      </TabsContent>
    </Tabs>
  );
}
