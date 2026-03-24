"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type AutomationsState = {
  followupRules: any[];
  behaviorRules: any[];
  abandonedRecovery: any | null;
};

type FollowupFormState = {
  ruleType: "reservation_reminder" | "post_visit_feedback" | "review_push" | "negative_feedback_route";
  reminder24h: boolean;
  reminder2h: boolean;
  postVisitDelayHours: string;
  reviewMinRating: string;
  negativeMaxRating: string;
};

type BehaviorFormState = {
  name: string;
  conditionType: "inactive_days" | "friday_regular" | "has_tag";
  inactiveDays: string;
  fridayMinBookings: string;
  requiredTag: string;
  offerType: "comeback" | "limited" | "birthday" | "upsell";
  channel: "web_chat" | "whatsapp" | "instagram";
  message: string;
};

const emptyState: AutomationsState = {
  followupRules: [],
  behaviorRules: [],
  abandonedRecovery: null
};

const createDefaultFollowupForm = (): FollowupFormState => ({
  ruleType: "reservation_reminder",
  reminder24h: true,
  reminder2h: true,
  postVisitDelayHours: "2",
  reviewMinRating: "4",
  negativeMaxRating: "3"
});

const createDefaultBehaviorForm = (): BehaviorFormState => ({
  name: "Comeback offer",
  conditionType: "inactive_days",
  inactiveDays: "30",
  fridayMinBookings: "3",
  requiredTag: "vip",
  offerType: "comeback",
  channel: "web_chat",
  message: "We miss you — here is a comeback offer."
});

const buildFollowupConfig = (form: FollowupFormState): Record<string, unknown> => {
  if (form.ruleType === "reservation_reminder") {
    const hours_before: number[] = [];
    if (form.reminder24h) hours_before.push(24);
    if (form.reminder2h) hours_before.push(2);
    return { hours_before: hours_before.length ? hours_before : [24, 2] };
  }

  if (form.ruleType === "post_visit_feedback") {
    return { delay_hours: Number(form.postVisitDelayHours) || 2, enabled: true };
  }

  if (form.ruleType === "review_push") {
    return { min_rating: Number(form.reviewMinRating) || 4, enabled: true };
  }

  return { max_rating: Number(form.negativeMaxRating) || 3, enabled: true };
};

const buildBehaviorCondition = (form: BehaviorFormState): Record<string, unknown> => {
  if (form.conditionType === "inactive_days") {
    return { type: "inactive_days", days: Number(form.inactiveDays) || 30 };
  }
  if (form.conditionType === "friday_regular") {
    return { type: "friday_regular", min_bookings: Number(form.fridayMinBookings) || 3 };
  }
  return { type: "has_tag", tag: form.requiredTag.trim() };
};

const buildBehaviorAction = (form: BehaviorFormState): Record<string, unknown> => ({
  offer_type: form.offerType,
  channel: form.channel,
  message: form.message
});

const describeFollowupRule = (rule: any) => {
  const config = (rule.config ?? {}) as Record<string, unknown>;
  if (rule.rule_type === "reservation_reminder") {
    const hours = Array.isArray(config.hours_before) ? config.hours_before : [];
    return `Reservation reminders at ${hours.length ? hours.map((hour) => `${hour}h`).join(" and ") : "24h and 2h"} before reservation.`;
  }
  if (rule.rule_type === "post_visit_feedback") {
    return `Post-visit feedback after ${Number(config.delay_hours ?? 2)} hours.`;
  }
  if (rule.rule_type === "review_push") {
    return `Review push when rating is at least ${Number(config.min_rating ?? 4)}.`;
  }
  if (rule.rule_type === "negative_feedback_route") {
    return `Route negative feedback when rating is ${Number(config.max_rating ?? 3)} or below.`;
  }
  if (rule.rule_type === "abandoned_booking") {
    return `Recover abandoned booking after ${Number(config.threshold_minutes ?? 15)} minutes.`;
  }
  return "Custom follow-up rule";
};

const describeBehaviorRule = (rule: any) => {
  const condition = (rule.condition ?? {}) as Record<string, unknown>;
  const action = (rule.action ?? {}) as Record<string, unknown>;

  let conditionLabel = "Custom condition";
  if (condition.type === "inactive_days") {
    conditionLabel = `No reservation for ${Number(condition.days ?? 30)} days`;
  } else if (condition.type === "friday_regular") {
    conditionLabel = `Books Fridays at least ${Number(condition.min_bookings ?? 3)} times`;
  } else if (condition.type === "has_tag") {
    conditionLabel = `Customer has tag '${String(condition.tag ?? "")}'`;
  }

  return {
    conditionLabel,
    actionLabel: `${String(action.offer_type ?? "offer")} via ${String(action.channel ?? "web_chat")}`,
    message: String(action.message ?? "")
  };
};

export default function AutomationsDashboardClient() {
  const { push } = useToast();
  const [state, setState] = useState<AutomationsState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFollowupCreator, setShowFollowupCreator] = useState(false);

  const [followupForm, setFollowupForm] = useState<FollowupFormState>(createDefaultFollowupForm());
  const [behaviorForm, setBehaviorForm] = useState<BehaviorFormState>(createDefaultBehaviorForm());
  const [abandonedMinutes, setAbandonedMinutes] = useState("15");
  const [abandonedEnabled, setAbandonedEnabled] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/automations", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load automations");
      }

      setState({
        followupRules: payload?.followupRules ?? [],
        behaviorRules: payload?.behaviorRules ?? [],
        abandonedRecovery: payload?.abandonedRecovery ?? null
      });

      if (payload?.abandonedRecovery?.config?.threshold_minutes) {
        setAbandonedMinutes(String(payload.abandonedRecovery.config.threshold_minutes));
      }
      if (typeof payload?.abandonedRecovery?.is_active === "boolean") {
        setAbandonedEnabled(Boolean(payload.abandonedRecovery.is_active));
      }
    } catch (error) {
      push({ title: "Load failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const mutate = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const response = await fetch("/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to save automations");
        }

        push({ title: "Saved", message: "Automation updated", variant: "success" });
        await loadData();
      } catch (error) {
        push({ title: "Save failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
      } finally {
        setSaving(false);
      }
    },
    [loadData, push]
  );

  const automationRows = useMemo(() => {
    const followups = state.followupRules
      .filter((rule) => rule.rule_type !== "abandoned_booking")
      .map((rule) => ({
        id: rule.id as string,
        kind: "followup" as const,
        name: String(rule.rule_type ?? "Follow-up"),
        description: describeFollowupRule(rule),
        is_active: Boolean(rule.is_active)
      }));

    const behaviors = state.behaviorRules.map((rule) => {
      const details = describeBehaviorRule(rule);
      return {
        id: rule.id as string,
        kind: "behavior" as const,
        name: String(rule.name ?? "Behavior offer"),
        description: `${details.conditionLabel} - ${details.actionLabel}`,
        is_active: Boolean(rule.is_active)
      };
    });

    return [...followups, ...behaviors];
  }, [state.behaviorRules, state.followupRules]);

  if (loading) {
    return <p className="text-sm text-white/70">Loading automations...</p>;
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Automation list</h3>
            <p className="text-sm text-white/60">Manage active follow-ups and behavior offers from one place.</p>
          </div>
          <Button onClick={() => setShowFollowupCreator((open) => !open)} data-tutorial-target="automations-new-rule">
            {showFollowupCreator ? "Close" : "New Follow-up Rule"}
          </Button>
        </div>

        {showFollowupCreator ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="space-y-1 text-sm text-white/80">
              <span>Rule type</span>
              <select
                value={followupForm.ruleType}
                onChange={(event) =>
                  setFollowupForm((prev) => ({
                    ...prev,
                    ruleType: event.target.value as FollowupFormState["ruleType"]
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-neutral-900/70 px-3 text-sm text-white"
              >
                <option value="reservation_reminder">Reservation reminder</option>
                <option value="post_visit_feedback">Post-visit feedback</option>
                <option value="review_push">Review push</option>
                <option value="negative_feedback_route">Negative feedback routing</option>
              </select>
            </label>

            {followupForm.ruleType === "reservation_reminder" ? (
              <div className="space-y-2 text-sm text-white/80">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={followupForm.reminder24h}
                    onChange={(event) => setFollowupForm((prev) => ({ ...prev, reminder24h: event.target.checked }))}
                  />
                  Send reminder 24 hours before
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={followupForm.reminder2h}
                    onChange={(event) => setFollowupForm((prev) => ({ ...prev, reminder2h: event.target.checked }))}
                  />
                  Send reminder 2 hours before
                </label>
              </div>
            ) : null}

            {followupForm.ruleType === "post_visit_feedback" ? (
              <Input
                type="number"
                min={1}
                placeholder="Hours after reservation"
                value={followupForm.postVisitDelayHours}
                onChange={(event) => setFollowupForm((prev) => ({ ...prev, postVisitDelayHours: event.target.value }))}
              />
            ) : null}

            {followupForm.ruleType === "review_push" ? (
              <Input
                type="number"
                min={1}
                max={5}
                placeholder="Minimum rating to send review request"
                value={followupForm.reviewMinRating}
                onChange={(event) => setFollowupForm((prev) => ({ ...prev, reviewMinRating: event.target.value }))}
              />
            ) : null}

            {followupForm.ruleType === "negative_feedback_route" ? (
              <Input
                type="number"
                min={1}
                max={5}
                placeholder="Maximum rating to treat as negative"
                value={followupForm.negativeMaxRating}
                onChange={(event) => setFollowupForm((prev) => ({ ...prev, negativeMaxRating: event.target.value }))}
              />
            ) : null}

            <Button
              disabled={saving}
              onClick={() =>
                mutate({
                  resource: "followup",
                  action: "create",
                  payload: {
                    rule_type: followupForm.ruleType,
                    config: buildFollowupConfig(followupForm)
                  }
                })
              }
              data-tutorial-target="automations-save-rule"
            >
              Add follow-up rule
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          {automationRows.length ? (
            automationRows.map((row) => (
              <div
                key={`${row.kind}-${row.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div>
                  <p className="text-sm font-semibold">{row.name}</p>
                  <p className="text-xs text-white/60">{row.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      mutate({
                        resource: row.kind,
                        action: "update",
                        id: row.id,
                        payload: { is_active: !row.is_active }
                      })
                    }
                  >
                    {row.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={saving}
                    onClick={() => mutate({ resource: row.kind, action: "delete", id: row.id })}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/60">No automations yet. Create your first follow-up rule.</p>
          )}
        </div>
      </Card>

      <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer text-sm font-semibold">Advanced</summary>
        <div className="mt-4 space-y-4">
          <Card className="space-y-3">
            <h3 className="text-base font-semibold">Behavior offers</h3>
            <Input
              placeholder="Rule name"
              value={behaviorForm.name}
              onChange={(event) => setBehaviorForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <select
              value={behaviorForm.conditionType}
              onChange={(event) =>
                setBehaviorForm((prev) => ({
                  ...prev,
                  conditionType: event.target.value as BehaviorFormState["conditionType"]
                }))
              }
              className="h-11 w-full rounded-xl border border-white/10 bg-neutral-900/70 px-3 text-sm text-white"
            >
              <option value="inactive_days">No reservation in X days</option>
              <option value="friday_regular">Frequent Friday customer</option>
              <option value="has_tag">Customer has tag</option>
            </select>
            {behaviorForm.conditionType === "inactive_days" ? (
              <Input
                type="number"
                min={1}
                placeholder="Inactive days"
                value={behaviorForm.inactiveDays}
                onChange={(event) => setBehaviorForm((prev) => ({ ...prev, inactiveDays: event.target.value }))}
              />
            ) : null}
            {behaviorForm.conditionType === "friday_regular" ? (
              <Input
                type="number"
                min={1}
                placeholder="Minimum Friday bookings"
                value={behaviorForm.fridayMinBookings}
                onChange={(event) => setBehaviorForm((prev) => ({ ...prev, fridayMinBookings: event.target.value }))}
              />
            ) : null}
            {behaviorForm.conditionType === "has_tag" ? (
              <Input
                placeholder="Required customer tag"
                value={behaviorForm.requiredTag}
                onChange={(event) => setBehaviorForm((prev) => ({ ...prev, requiredTag: event.target.value }))}
              />
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={behaviorForm.offerType}
                onChange={(event) =>
                  setBehaviorForm((prev) => ({
                    ...prev,
                    offerType: event.target.value as BehaviorFormState["offerType"]
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-neutral-900/70 px-3 text-sm text-white"
              >
                <option value="comeback">Comeback</option>
                <option value="limited">Limited time</option>
                <option value="birthday">Birthday</option>
                <option value="upsell">Upsell</option>
              </select>
              <select
                value={behaviorForm.channel}
                onChange={(event) =>
                  setBehaviorForm((prev) => ({
                    ...prev,
                    channel: event.target.value as BehaviorFormState["channel"]
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-neutral-900/70 px-3 text-sm text-white"
              >
                <option value="web_chat">Web chat</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
            <Textarea
              placeholder="Message sent to customer"
              value={behaviorForm.message}
              onChange={(event) => setBehaviorForm((prev) => ({ ...prev, message: event.target.value }))}
            />
            <Button
              disabled={saving || !behaviorForm.name.trim() || !behaviorForm.message.trim()}
              onClick={() =>
                mutate({
                  resource: "behavior",
                  action: "create",
                  payload: {
                    name: behaviorForm.name,
                    condition: buildBehaviorCondition(behaviorForm),
                    action: buildBehaviorAction(behaviorForm)
                  }
                })
              }
            >
              Add behavior offer
            </Button>
          </Card>

          <Card className="space-y-3">
            <h3 className="text-base font-semibold">Abandoned booking recovery</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                type="number"
                min={1}
                value={abandonedMinutes}
                onChange={(event) => setAbandonedMinutes(event.target.value)}
                placeholder="Minutes before recovery message"
              />
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={abandonedEnabled}
                  onChange={(event) => setAbandonedEnabled(event.target.checked)}
                />
                Enabled
              </label>
            </div>
            <Button
              disabled={saving}
              onClick={() =>
                mutate({
                  resource: "abandoned",
                  action: "upsert",
                  payload: {
                    threshold_minutes: Number(abandonedMinutes) || 15,
                    enabled: abandonedEnabled
                  }
                })
              }
            >
              Save abandoned recovery
            </Button>
            {state.abandonedRecovery ? (
              <p className="text-xs text-white/60">{describeFollowupRule(state.abandonedRecovery)}</p>
            ) : null}
          </Card>
        </div>
      </details>
    </div>
  );
}
