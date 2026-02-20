"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type SalesState = {
  upsells: any[];
  faqEntries: any[];
  objectionScripts: any[];
  catalogItems: any[];
  qualificationQuestions: Array<{ field: string; question: string }>;
};

type UpsellTriggerType = "reservation_size" | "time" | "intent" | "menu_item" | "custom";

type UpsellFormState = {
  name: string;
  description: string;
  triggerType: UpsellTriggerType;
  minSize: string;
  startTime: string;
  endTime: string;
  keywords: string;
  offerTitle: string;
  offerDescription: string;
  offerCta: string;
  offerPrice: string;
};

const emptyState: SalesState = {
  upsells: [],
  faqEntries: [],
  objectionScripts: [],
  catalogItems: [],
  qualificationQuestions: []
};

const createDefaultUpsellForm = (): UpsellFormState => ({
  name: "",
  description: "",
  triggerType: "intent",
  minSize: "4",
  startTime: "18:00",
  endTime: "21:00",
  keywords: "birthday, anniversary",
  offerTitle: "Celebration package",
  offerDescription: "Add a custom cake + decor",
  offerCta: "Add package",
  offerPrice: "€29"
});

const objectionOptions = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "dont_need", label: "Don't need it" },
  { value: "call_only", label: "Call only" },
  { value: "not_trust_ai", label: "Don't trust AI" }
] as const;

const formatTriggerSummary = (item: any) => {
  const rules = (item.trigger_rules ?? {}) as Record<string, unknown>;

  if (item.trigger_type === "reservation_size") {
    return `Party size >= ${Number(rules.min_size ?? 0) || 0}`;
  }

  if (item.trigger_type === "time") {
    return `${String(rules.start ?? "--:--")} to ${String(rules.end ?? "--:--")}`;
  }

  if (item.trigger_type === "intent" || item.trigger_type === "custom" || item.trigger_type === "menu_item") {
    const keywords = Array.isArray(rules.keywords) ? rules.keywords : [];
    return keywords.length ? `Keywords: ${keywords.join(", ")}` : "No keywords set";
  }

  return "Custom trigger";
};

const formatPrice = (value: unknown) => {
  if (!value) return "";
  return String(value);
};

const splitKeywords = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const buildUpsellPayload = (form: UpsellFormState) => {
  const trigger_rules: Record<string, unknown> = {};

  if (form.triggerType === "reservation_size") {
    trigger_rules.min_size = Number(form.minSize) || 4;
  }

  if (form.triggerType === "time") {
    trigger_rules.start = form.startTime || "18:00";
    trigger_rules.end = form.endTime || "21:00";
  }

  if (form.triggerType === "intent" || form.triggerType === "custom" || form.triggerType === "menu_item") {
    trigger_rules.keywords = splitKeywords(form.keywords);
  }

  return {
    name: form.name,
    description: form.description,
    trigger_type: form.triggerType,
    trigger_rules,
    offer_payload: {
      title: form.offerTitle,
      description: form.offerDescription,
      cta: form.offerCta,
      price: form.offerPrice
    }
  };
};

export default function SalesDashboardClient() {
  const { push } = useToast();
  const [state, setState] = useState<SalesState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [upsellForm, setUpsellForm] = useState<UpsellFormState>(createDefaultUpsellForm());

  const [faqForm, setFaqForm] = useState({ question: "", answer: "", category: "general", keywords: "" });
  const [objectionForm, setObjectionForm] = useState({
    objection_key: "too_expensive",
    response_text: "I understand budget matters. We can start with a smaller package and scale as results come in.",
    phrases: "too expensive, cost too much"
  });
  const [catalogForm, setCatalogForm] = useState({ name: "", description: "", tags: "", price: "" });

  const qualificationByField = useMemo(() => {
    const defaultRows = [
      { field: "budget_range", question: "What budget range are you planning for this project?" },
      { field: "urgency", question: "How soon do you need this done (today, this week, or later)?" },
      { field: "decision_maker", question: "Are you the decision-maker for this purchase?" }
    ];

    if (!state.qualificationQuestions.length) {
      return defaultRows;
    }

    return defaultRows.map((row) => {
      const found = state.qualificationQuestions.find((item) => item.field === row.field);
      return found ? { ...row, question: found.question } : row;
    });
  }, [state.qualificationQuestions]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/chatbot/sales", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load sales config");
      }

      setState({
        upsells: payload.upsells ?? [],
        faqEntries: payload.faqEntries ?? [],
        objectionScripts: payload.objectionScripts ?? [],
        catalogItems: payload.catalogItems ?? [],
        qualificationQuestions: payload.qualificationQuestions ?? []
      });
    } catch (error) {
      push({ title: "Load failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const mutate = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const response = await fetch("/api/chatbot/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to save");
      }

      push({ title: "Saved", message: "Configuration updated", variant: "success" });
      await loadData();
    } catch (error) {
      push({ title: "Save failed", message: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-white/70">Loading sales configuration...</p>;
  }

  return (
    <Tabs defaultValue="upsells" className="space-y-4">
      <TabsList>
        <TabsTrigger value="upsells">Upsells</TabsTrigger>
        <TabsTrigger value="faq">FAQ</TabsTrigger>
        <TabsTrigger value="objections">Objections</TabsTrigger>
      </TabsList>

      <TabsContent value="upsells" className="space-y-4">
        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Create Upsell Offer</h3>
            <p className="text-sm text-white/60">Use plain form fields. No JSON required.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Internal offer name"
              value={upsellForm.name}
              onChange={(event) => setUpsellForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <select
              value={upsellForm.triggerType}
              onChange={(event) => setUpsellForm((prev) => ({ ...prev, triggerType: event.target.value as UpsellTriggerType }))}
              className="h-11 w-full rounded-xl border border-white/10 bg-neutral-900/70 px-3 text-sm text-white"
            >
              <option value="intent">Intent keywords</option>
              <option value="reservation_size">Reservation size</option>
              <option value="time">Reservation time window</option>
              <option value="menu_item">Menu item mention</option>
              <option value="custom">Custom keywords</option>
            </select>
          </div>

          <Textarea
            placeholder="Optional internal description"
            value={upsellForm.description}
            onChange={(event) => setUpsellForm((prev) => ({ ...prev, description: event.target.value }))}
          />

          {upsellForm.triggerType === "reservation_size" ? (
            <Input
              type="number"
              min={1}
              placeholder="Trigger when party size is at least"
              value={upsellForm.minSize}
              onChange={(event) => setUpsellForm((prev) => ({ ...prev, minSize: event.target.value }))}
            />
          ) : null}

          {upsellForm.triggerType === "time" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-white/80">
                <span>Start time</span>
                <Input
                  type="time"
                  value={upsellForm.startTime}
                  onChange={(event) => setUpsellForm((prev) => ({ ...prev, startTime: event.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm text-white/80">
                <span>End time</span>
                <Input
                  type="time"
                  value={upsellForm.endTime}
                  onChange={(event) => setUpsellForm((prev) => ({ ...prev, endTime: event.target.value }))}
                />
              </label>
            </div>
          ) : null}

          {(upsellForm.triggerType === "intent" ||
            upsellForm.triggerType === "custom" ||
            upsellForm.triggerType === "menu_item") ? (
            <Input
              placeholder="Trigger keywords (comma separated)"
              value={upsellForm.keywords}
              onChange={(event) => setUpsellForm((prev) => ({ ...prev, keywords: event.target.value }))}
            />
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold">Offer shown to customer</p>
            <div className="mt-3 space-y-3">
              <Input
                placeholder="Offer title"
                value={upsellForm.offerTitle}
                onChange={(event) => setUpsellForm((prev) => ({ ...prev, offerTitle: event.target.value }))}
              />
              <Textarea
                placeholder="Offer description"
                value={upsellForm.offerDescription}
                onChange={(event) => setUpsellForm((prev) => ({ ...prev, offerDescription: event.target.value }))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Button text (CTA)"
                  value={upsellForm.offerCta}
                  onChange={(event) => setUpsellForm((prev) => ({ ...prev, offerCta: event.target.value }))}
                />
                <Input
                  placeholder="Price label (e.g. €29)"
                  value={upsellForm.offerPrice}
                  onChange={(event) => setUpsellForm((prev) => ({ ...prev, offerPrice: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <Button
            disabled={saving || !upsellForm.name.trim() || !upsellForm.offerTitle.trim()}
            onClick={() =>
              mutate({
                resource: "upsell",
                action: "create",
                payload: buildUpsellPayload(upsellForm)
              })
            }
          >
            Add upsell
          </Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Active Upsells</h3>
          {state.upsells.length ? (
            state.upsells.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{item.name}</p>
                    <p className="text-xs text-white/60">Trigger: {formatTriggerSummary(item)}</p>
                    <p className="text-xs text-white/60">
                      Offer: {String(item.offer_payload?.title ?? item.name)} {formatPrice(item.offer_payload?.price)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() =>
                        mutate({
                          resource: "upsell",
                          action: "update",
                          id: item.id,
                          payload: { is_active: !item.is_active }
                        })
                      }
                    >
                      {item.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={saving}
                      onClick={() => mutate({ resource: "upsell", action: "delete", id: item.id })}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/60">No upsell rules yet.</p>
          )}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Catalog Items (for recommendations)</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Item name"
              value={catalogForm.name}
              onChange={(event) => setCatalogForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              placeholder="Price"
              value={catalogForm.price}
              onChange={(event) => setCatalogForm((prev) => ({ ...prev, price: event.target.value }))}
            />
          </div>
          <Textarea
            placeholder="Description"
            value={catalogForm.description}
            onChange={(event) => setCatalogForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <Input
            placeholder="Tags (comma separated, e.g. vegan,light,group)"
            value={catalogForm.tags}
            onChange={(event) => setCatalogForm((prev) => ({ ...prev, tags: event.target.value }))}
          />
          <Button
            disabled={saving || !catalogForm.name.trim()}
            onClick={() =>
              mutate({
                resource: "catalog",
                action: "create",
                payload: {
                  name: catalogForm.name,
                  description: catalogForm.description,
                  tags: catalogForm.tags
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                  price: catalogForm.price ? Number(catalogForm.price) : null
                }
              })
            }
          >
            Add catalog item
          </Button>

          {state.catalogItems.length ? (
            <div className="space-y-2">
              {state.catalogItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <div>
                    <p>{item.name}</p>
                    <p className="text-xs text-white/60">{Array.isArray(item.tags) ? item.tags.join(", ") : ""}</p>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => mutate({ resource: "catalog", action: "delete", id: item.id })}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Lead Qualification Questions</h3>
          {qualificationByField.map((row) => (
            <div key={row.field} className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">{row.field}</p>
              <Input
                value={row.question}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    qualificationQuestions: qualificationByField.map((item) =>
                      item.field === row.field ? { ...item, question: event.target.value } : item
                    )
                  }))
                }
              />
            </div>
          ))}
          <Button
            disabled={saving}
            onClick={() =>
              mutate({
                resource: "qualification",
                action: "upsert",
                payload: {
                  questions: qualificationByField
                }
              })
            }
          >
            Save qualification questions
          </Button>
        </Card>
      </TabsContent>

      <TabsContent value="faq" className="space-y-4">
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Add FAQ Entry</h3>
          <Input
            placeholder="Question"
            value={faqForm.question}
            onChange={(event) => setFaqForm((prev) => ({ ...prev, question: event.target.value }))}
          />
          <Textarea
            placeholder="Answer"
            value={faqForm.answer}
            onChange={(event) => setFaqForm((prev) => ({ ...prev, answer: event.target.value }))}
          />
          <Input
            placeholder="Keywords (comma separated)"
            value={faqForm.keywords}
            onChange={(event) => setFaqForm((prev) => ({ ...prev, keywords: event.target.value }))}
          />
          <Button
            disabled={saving || !faqForm.question.trim() || !faqForm.answer.trim()}
            onClick={() =>
              mutate({
                resource: "faq",
                action: "create",
                payload: {
                  question: faqForm.question,
                  answer: faqForm.answer,
                  category: faqForm.category,
                  keywords: faqForm.keywords
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                }
              })
            }
          >
            Add FAQ
          </Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">FAQ List</h3>
          {state.faqEntries.length ? (
            state.faqEntries.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-medium">{item.question}</p>
                <p className="mt-1 text-sm text-white/80">{item.answer}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      mutate({ resource: "faq", action: "update", id: item.id, payload: { is_active: !item.is_active } })
                    }
                  >
                    {item.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => mutate({ resource: "faq", action: "delete", id: item.id })}>
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/60">No FAQ entries yet.</p>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="objections" className="space-y-4">
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Add Objection Script</h3>
          <label className="space-y-1 text-sm text-white/80">
            <span>Objection type</span>
            <select
              value={objectionForm.objection_key}
              onChange={(event) => setObjectionForm((prev) => ({ ...prev, objection_key: event.target.value }))}
              className="h-11 w-full rounded-xl border border-white/10 bg-neutral-900/70 px-3 text-sm text-white"
            >
              {objectionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Textarea
            placeholder="Response shown when this objection appears"
            value={objectionForm.response_text}
            onChange={(event) => setObjectionForm((prev) => ({ ...prev, response_text: event.target.value }))}
          />
          <Input
            placeholder="Match phrases (comma separated)"
            value={objectionForm.phrases}
            onChange={(event) => setObjectionForm((prev) => ({ ...prev, phrases: event.target.value }))}
          />
          <Button
            disabled={saving || !objectionForm.response_text.trim()}
            onClick={() =>
              mutate({
                resource: "objection",
                action: "create",
                payload: {
                  objection_key: objectionForm.objection_key,
                  response_text: objectionForm.response_text,
                  phrases: objectionForm.phrases
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                }
              })
            }
          >
            Add objection script
          </Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Objection Scripts</h3>
          {state.objectionScripts.length ? (
            state.objectionScripts.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-medium">{item.objection_key}</p>
                <p className="mt-1 text-sm text-white/80">{item.response_text}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      mutate({
                        resource: "objection",
                        action: "update",
                        id: item.id,
                        payload: { is_active: !item.is_active }
                      })
                    }
                  >
                    {item.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => mutate({ resource: "objection", action: "delete", id: item.id })}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/60">No objection scripts yet.</p>
          )}
        </Card>
      </TabsContent>
    </Tabs>
  );
}
