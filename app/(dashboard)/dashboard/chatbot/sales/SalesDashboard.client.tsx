"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

const CATEGORY_LABELS: Record<string, string> = {
  offer: "Offer",
  closure: "Closure",
  reservation_constraint: "Reservation rule",
  recommendation: "Recommendation",
  service_notice: "Service notice",
  faq: "FAQ",
  general_notice: "General notice"
};

type EntryRow = {
  id: string;
  input_text: string;
  status: "pending_review" | "applied" | "discarded";
  created_at: string;
};

type RuleRow = {
  id: string;
  entry_id: string | null;
  category: string;
  title: string;
  body: string;
  keywords: string[];
  metadata: Record<string, any> | null;
  enabled: boolean;
  approval_status: "pending" | "approved" | "discarded";
  created_at: string;
  triggerSummary?: string;
};

type RuleDraft = {
  title: string;
  body: string;
  metadata: Record<string, any>;
};

type PageState = {
  entries: EntryRow[];
  pendingRules: RuleRow[];
  activeRules: RuleRow[];
  discardedRules: RuleRow[];
  migrationRequired?: boolean;
};

const emptyState: PageState = {
  entries: [],
  pendingRules: [],
  activeRules: [],
  discardedRules: [],
  migrationRequired: false
};

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const listToValue = (value: unknown) => (Array.isArray(value) ? value.map(String).join(", ") : "");

const cloneMetadata = (value: Record<string, any> | null | undefined) => {
  if (!value || typeof value !== "object") return {};
  return JSON.parse(JSON.stringify(value));
};

const toNullableNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRuleDraft = (rule: RuleRow): RuleDraft => ({
  title: rule.title,
  body: rule.body,
  metadata: cloneMetadata(rule.metadata)
});

const summarizeActiveTrigger = (rule: RuleRow) => {
  if (rule.triggerSummary) return rule.triggerSummary;
  switch (rule.category) {
    case "closure":
      return "Blocks reservations only on the configured date or occasion.";
    case "offer":
      return "Shown when a customer asks about deals or promotions.";
    case "recommendation":
      return "Shown when a customer asks what to order or what you recommend.";
    case "reservation_constraint":
      return "Applied during reservation checks only when the constraint actually matches.";
    default:
      return "Used when the customer asks about the matching business topic.";
  }
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-white/35">{hint}</span> : null}
    </label>
  );
}

function TriggerSummary({ summary }: { summary?: string }) {
  if (!summary) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Triggers when...</p>
      <p className="mt-2 text-sm text-white/72">{summary}</p>
    </div>
  );
}

function RuleMetadataEditor({
  rule,
  draft,
  onChange
}: {
  rule: RuleRow;
  draft: RuleDraft;
  onChange: (patch: Partial<RuleDraft>) => void;
}) {
  const metadata = draft.metadata ?? {};

  const patchMetadata = (patch: Record<string, any>) => {
    onChange({ metadata: { ...metadata, ...patch } });
  };

  switch (rule.category) {
    case "closure":
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Blocked dates" hint="Use ISO dates like 2026-03-22. Multiple dates separated by commas.">
            <Input
              value={listToValue(metadata.blocked_dates)}
              onChange={(event) => patchMetadata({ blocked_dates: parseList(event.target.value) })}
              className="border-white/10 bg-white/[0.02] text-white"
            />
          </Field>
          <Field label="Occasion label" hint="Shown to the customer, for example Eid or Christmas.">
            <Input
              value={typeof metadata.occasion_label === "string" ? metadata.occasion_label : ""}
              onChange={(event) => patchMetadata({ occasion_label: event.target.value })}
              className="border-white/10 bg-white/[0.02] text-white"
            />
          </Field>
        </div>
      );

    case "offer":
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Offer summary" hint="Short version of the offer that powers the live reply.">
            <Textarea
              value={typeof metadata.offer_summary === "string" ? metadata.offer_summary : ""}
              onChange={(event) => patchMetadata({ offer_summary: event.target.value })}
              className="min-h-[100px] border-white/10 bg-white/[0.02] text-white"
            />
          </Field>
          <div className="grid gap-3">
            <Field label="Starts on">
              <Input
                value={typeof metadata.active_from === "string" ? metadata.active_from : ""}
                onChange={(event) => patchMetadata({ active_from: event.target.value || null })}
                placeholder="2026-03-22"
                className="border-white/10 bg-white/[0.02] text-white"
              />
            </Field>
            <Field label="Ends on">
              <Input
                value={typeof metadata.active_until === "string" ? metadata.active_until : ""}
                onChange={(event) => patchMetadata({ active_until: event.target.value || null })}
                placeholder="2026-03-29"
                className="border-white/10 bg-white/[0.02] text-white"
              />
            </Field>
          </div>
        </div>
      );

    case "recommendation":
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Item or service name">
            <Input
              value={typeof metadata.item_name === "string" ? metadata.item_name : ""}
              onChange={(event) => patchMetadata({ item_name: event.target.value })}
              className="border-white/10 bg-white/[0.02] text-white"
            />
          </Field>
          <Field label="Why suggest it">
            <Textarea
              value={typeof metadata.reason === "string" ? metadata.reason : ""}
              onChange={(event) => patchMetadata({ reason: event.target.value })}
              className="min-h-[100px] border-white/10 bg-white/[0.02] text-white"
            />
          </Field>
        </div>
      );

    case "reservation_constraint":
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Blocked dates" hint="Optional. Only blocks these exact dates.">
            <Input
              value={listToValue(metadata.blocked_dates)}
              onChange={(event) => patchMetadata({ blocked_dates: parseList(event.target.value) })}
              className="border-white/10 bg-white/[0.02] text-white"
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Minimum party size">
              <Input
                value={metadata.min_party_size ?? ""}
                onChange={(event) => patchMetadata({ min_party_size: toNullableNumber(event.target.value) })}
                className="border-white/10 bg-white/[0.02] text-white"
              />
            </Field>
            <Field label="Maximum party size">
              <Input
                value={metadata.max_party_size ?? ""}
                onChange={(event) => patchMetadata({ max_party_size: toNullableNumber(event.target.value) })}
                className="border-white/10 bg-white/[0.02] text-white"
              />
            </Field>
          </div>
        </div>
      );

    case "faq":
      return (
        <Field label="Question scope" hint="This is a read-only summary of when the bot will use the answer.">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/72">
            {rule.triggerSummary ?? "Used when the customer asks the matching question."}
          </div>
        </Field>
      );

    default:
      return (
        <Field label="Rule scope" hint="This is a read-only summary of when the bot will use the notice.">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/72">
            {rule.triggerSummary ?? "Used when the customer asks about the matching business topic."}
          </div>
        </Field>
      );
  }
}

export default function SalesDashboardClient() {
  const { push } = useToast();
  const [state, setState] = useState<PageState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inputText, setInputText] = useState("");
  const [drafts, setDrafts] = useState<Record<string, RuleDraft>>({});

  const syncState = (payload: any) => {
    setState({
      entries: payload?.entries ?? [],
      pendingRules: payload?.pendingRules ?? [],
      activeRules: payload?.activeRules ?? [],
      discardedRules: payload?.discardedRules ?? [],
      migrationRequired: Boolean(payload?.migrationRequired)
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/chatbot/sales", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load update info");
      }
      syncState(payload);
    } catch (error) {
      push({ title: "Load failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = useCallback(
    async (body: Record<string, unknown>, successMessage: string) => {
      setSaving(true);
      try {
        const response = await fetch("/api/chatbot/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Save failed");
        }
        syncState(payload);
        push({ title: "Saved", message: successMessage, variant: "success" });
      } catch (error) {
        push({ title: "Save failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
      } finally {
        setSaving(false);
      }
    },
    [push]
  );

  const handleSubmitEntry = async () => {
    if (inputText.trim().length < 8) return;
    await mutate({ action: "submit_entry", inputText }, "Update submitted for review.");
    setInputText("");
  };

  const getRuleDraft = (rule: RuleRow) => drafts[rule.id] ?? toRuleDraft(rule);

  const setRuleDraft = (ruleId: string, patch: Partial<RuleDraft>) => {
    setDrafts((prev) => {
      const base = prev[ruleId] ?? { title: "", body: "", metadata: {} };
      return {
        ...prev,
        [ruleId]: {
          title: patch.title ?? base.title,
          body: patch.body ?? base.body,
          metadata: patch.metadata ?? base.metadata
        }
      };
    });
  };

  const recentEntries = useMemo(() => state.entries.slice(0, 10), [state.entries]);

  return (
    <div className="space-y-6">
      {state.migrationRequired ? (
        <Card className="border-amber-500/20 bg-amber-500/10">
          <p className="text-sm font-semibold text-white">Database migration required</p>
          <p className="mt-2 text-sm text-white/70">
            Update Info is running in safe fallback mode. Apply the latest migration before expecting new rules to persist.
          </p>
        </Card>
      ) : null}

      <Card className="bg-[#0f1117]">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">Add business info</p>
            <p className="mt-1 text-sm text-white/60">
              Paste closures, offers, reservation rules, menu recommendations, service notices, or anything else the chatbot should use.
              Nothing goes live until you approve the extracted rules.
            </p>
          </div>

          <PromptInputBox
            value={inputText}
            onValueChange={setInputText}
            onSend={async (message) => {
              setInputText(message);
              await mutate({ action: "submit_entry", inputText: message }, "Update submitted for review.");
              setInputText("");
            }}
            isLoading={saving}
            submitLabel="Extract rules"
            placeholder="Example: We are closed on 22.03.2026 because of Eid. Recommend the carbonara and tiramisu when guests ask what to order. Guests who mention SPRING this weekend get a free dessert."
          />

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => void load()} disabled={loading || saving}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr,1fr]">
        <Card className="bg-[#0f1117]">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-white">Pending review</p>
              <p className="mt-1 text-sm text-white/60">Approve only the facts the chatbot should use live.</p>
            </div>

            {state.pendingRules.length ? (
              state.pendingRules.map((rule) => {
                const draft = getRuleDraft(rule);
                return (
                  <div key={rule.id} className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
                        {CATEGORY_LABELS[rule.category] ?? rule.category}
                      </span>
                      <span className="text-xs text-white/45">{new Date(rule.created_at).toLocaleString()}</span>
                    </div>

                    <div className="space-y-3">
                      <Field label="Rule title">
                        <Input
                          value={draft.title}
                          onChange={(event) => setRuleDraft(rule.id, { title: event.target.value })}
                          className="border-white/10 bg-white/[0.02] text-white"
                        />
                      </Field>

                      <Field label="Customer-facing reply" hint="This is the actual text the chatbot will use when the rule applies.">
                        <Textarea
                          value={draft.body}
                          onChange={(event) => setRuleDraft(rule.id, { body: event.target.value })}
                          className="min-h-[120px] border-white/10 bg-white/[0.02] text-white"
                        />
                      </Field>

                      <RuleMetadataEditor
                        rule={rule}
                        draft={draft}
                        onChange={(patch) => setRuleDraft(rule.id, patch)}
                      />

                      <TriggerSummary summary={rule.triggerSummary} />

                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Preview</p>
                        <p className="mt-2 text-sm text-white/80">{draft.body}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          void mutate(
                            {
                              action: "approve_rule",
                              ruleId: rule.id,
                              payload: {
                                title: draft.title,
                                body: draft.body,
                                metadata: draft.metadata,
                                enabled: true
                              }
                            },
                            "Rule approved."
                          )
                        }
                        disabled={saving}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          void mutate(
                            {
                              action: "discard_rule",
                              ruleId: rule.id
                            },
                            "Rule discarded."
                          )
                        }
                        disabled={saving}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Discard
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/55">
                {loading ? "Loading..." : "No pending rules right now."}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="bg-[#0f1117]">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-white">Active rules</p>
                <p className="mt-1 text-sm text-white/60">These are the rules the chatbot can use live.</p>
              </div>

              {state.activeRules.length ? (
                state.activeRules.map((rule) => (
                  <div key={rule.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{rule.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">
                          {CATEGORY_LABELS[rule.category] ?? rule.category}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void mutate(
                            { action: "toggle_rule", ruleId: rule.id, enabled: !rule.enabled },
                            rule.enabled ? "Rule disabled." : "Rule enabled."
                          )
                        }
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          rule.enabled ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/65"
                        )}
                      >
                        {rule.enabled ? "Live" : "Off"}
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-white/80">{rule.body}</p>
                    <p className="mt-3 text-xs text-white/50">{summarizeActiveTrigger(rule)}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/55">
                  No approved rules live yet.
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-[#0f1117]">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-white">Recent updates</p>
                <p className="mt-1 text-sm text-white/60">Raw business notes that generated the rules above.</p>
              </div>

              {recentEntries.length ? (
                recentEntries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.16em] text-white/45">{entry.status.replace(/_/g, " ")}</span>
                      <button
                        type="button"
                        onClick={() => void mutate({ action: "delete_entry", entryId: entry.id }, "Entry removed.")}
                        className="text-white/50 transition hover:text-white"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-white/80">{entry.input_text}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/55">
                  No updates submitted yet.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
