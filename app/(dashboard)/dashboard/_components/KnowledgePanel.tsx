"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type BusinessTopicItem = {
  id: string;
  topic: string;
  keywords: string[];
  enabled: boolean;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type TopicEditorItem = {
  id: string;
  topic: string;
  keywordsText: string;
  enabled: boolean;
};

type TopTopic = {
  topic: string;
  count: number;
};

const parseKeywords = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export function KnowledgePanel({
  businessId,
  initialTopics,
  initialFaqs,
  topTopics
}: {
  businessId: string;
  initialTopics: BusinessTopicItem[];
  initialFaqs: FaqItem[];
  topTopics: TopTopic[];
}) {
  const { push } = useToast();
  const searchParams = useSearchParams();
  const topicParam = searchParams?.get("topic") ?? "";

  const [topics, setTopics] = useState<TopicEditorItem[]>(() =>
    initialTopics.map((topic) => ({
      id: topic.id,
      topic: topic.topic,
      keywordsText: topic.keywords.join(", "),
      enabled: topic.enabled
    }))
  );
  const [faqs, setFaqs] = useState<FaqItem[]>(() => initialFaqs);
  const [draftOpen, setDraftOpen] = useState(Boolean(topicParam));
  const [draftFaq, setDraftFaq] = useState({
    question: topicParam,
    answer: ""
  });
  const [newTopic, setNewTopic] = useState({
    topic: "",
    keywordsText: "",
    enabled: true
  });
  const [savingTopicId, setSavingTopicId] = useState<string | null>(null);
  const [savingFaqId, setSavingFaqId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    if (!topicParam) return;
    setDraftOpen(true);
    setDraftFaq((prev) => ({
      question: prev.question.trim() ? prev.question : topicParam,
      answer: prev.answer
    }));
  }, [topicParam]);

  const updateTopicField = (id: string, field: "topic" | "keywordsText" | "enabled", value: string | boolean) => {
    setTopics((prev) =>
      prev.map((topic) => (topic.id === id ? { ...topic, [field]: value } : topic))
    );
  };

  const saveTopic = async (topic: TopicEditorItem) => {
    const trimmedTopic = topic.topic.trim();
    if (!trimmedTopic) {
      push({ title: "Topic required", message: "Enter a topic name before saving.", variant: "error" });
      return;
    }

    setSavingTopicId(topic.id);
    const keywords = parseKeywords(topic.keywordsText);

    const { error } = await (getSupabaseBrowserClient() as any)
      .from("business_topics")
      .update({
        topic: trimmedTopic,
        keywords,
        enabled: topic.enabled
      })
      .eq("id", topic.id);

    setSavingTopicId(null);

    if (error) {
      push({ title: "Failed to save topic", message: error.message, variant: "error" });
      return;
    }

    setTopics((prev) =>
      prev.map((item) =>
        item.id === topic.id ? { ...item, topic: trimmedTopic, keywordsText: keywords.join(", ") } : item
      )
    );
    push({ title: "Topic saved", message: "Topic updates are live.", variant: "success" });
  };

  const addTopic = async () => {
    const trimmedTopic = newTopic.topic.trim();
    if (!trimmedTopic) {
      push({ title: "Topic required", message: "Enter a topic name to add.", variant: "error" });
      return;
    }

    const keywords = parseKeywords(newTopic.keywordsText);
    const { data, error } = await (getSupabaseBrowserClient() as any)
      .from("business_topics")
      .insert({
        business_id: businessId,
        topic: trimmedTopic,
        keywords,
        enabled: newTopic.enabled
      })
      .select("id, topic, keywords, enabled")
      .single();

    if (error) {
      push({ title: "Failed to add topic", message: error.message, variant: "error" });
      return;
    }

    const inserted = data as BusinessTopicItem;
    setTopics((prev) => [
      {
        id: inserted.id,
        topic: inserted.topic,
        keywordsText: (inserted.keywords ?? []).join(", "),
        enabled: inserted.enabled
      },
      ...prev
    ]);
    setNewTopic({ topic: "", keywordsText: "", enabled: true });
    push({ title: "Topic added", message: "Your topic is now tracked.", variant: "success" });
  };

  const saveFaq = async (faq: FaqItem) => {
    const trimmedQuestion = faq.question.trim();
    const trimmedAnswer = faq.answer.trim();
    if (!trimmedQuestion || !trimmedAnswer) {
      push({ title: "FAQ incomplete", message: "Both question and answer are required.", variant: "error" });
      return;
    }

    setSavingFaqId(faq.id);
    const { error } = await (getSupabaseBrowserClient() as any)
      .from("business_faq_items")
      .update({ question: trimmedQuestion, answer: trimmedAnswer })
      .eq("id", faq.id);

    setSavingFaqId(null);

    if (error) {
      push({ title: "Failed to save FAQ", message: error.message, variant: "error" });
      return;
    }

    setFaqs((prev) =>
      prev.map((item) =>
        item.id === faq.id ? { ...item, question: trimmedQuestion, answer: trimmedAnswer } : item
      )
    );
    push({ title: "FAQ saved", message: "Your FAQ is updated.", variant: "success" });
  };

  const addFaqDraft = async () => {
    const trimmedQuestion = draftFaq.question.trim();
    const trimmedAnswer = draftFaq.answer.trim();
    if (!trimmedQuestion || !trimmedAnswer) {
      push({ title: "FAQ incomplete", message: "Add both a question and answer before saving.", variant: "error" });
      return;
    }

    setSavingDraft(true);
    const { data, error } = await (getSupabaseBrowserClient() as any)
      .from("business_faq_items")
      .insert({ business_id: businessId, question: trimmedQuestion, answer: trimmedAnswer })
      .select("id, question, answer, created_at, updated_at")
      .single();
    setSavingDraft(false);

    if (error) {
      push({ title: "Failed to add FAQ", message: error.message, variant: "error" });
      return;
    }

    const inserted = data as FaqItem;
    setFaqs((prev) => [inserted, ...prev]);
    setDraftFaq({ question: topicParam || "", answer: "" });
    push({ title: "FAQ added", message: "Your new FAQ is live.", variant: "success" });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Top topics this week</p>
            <p className="text-xs text-white/60">Based on live conversations</p>
          </div>
          <Badge variant="info">{topTopics.length}</Badge>
        </div>
        <div className="mt-4 space-y-2">
          {topTopics.length ? (
            topTopics.map((entry) => (
              <div
                key={entry.topic}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-neutral-950/60 px-4 py-3"
              >
                <span className="text-sm font-semibold">{entry.topic}</span>
                <span className="text-xs text-white/60">{entry.count} mentions</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/60">No topic mentions yet. They will appear after chat activity.</p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Tracked topics</p>
            <p className="text-xs text-white/60">Edit keywords to fine-tune analytics.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-white/60">
            New topic
            <Input
              value={newTopic.topic}
              onChange={(event) => setNewTopic((prev) => ({ ...prev, topic: event.target.value }))}
              className="mt-2"
            />
          </label>
          <label className="text-xs text-white/60 md:col-span-2">
            Keywords (comma separated)
            <Input
              value={newTopic.keywordsText}
              onChange={(event) => setNewTopic((prev) => ({ ...prev, keywordsText: event.target.value }))}
              className="mt-2"
            />
          </label>
          <label className="flex items-center gap-3 text-xs text-white/60">
            <Switch
              checked={newTopic.enabled}
              onChange={(event) => setNewTopic((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            Enabled
          </label>
          <div className="flex items-center">
            <Button variant="secondary" onClick={addTopic}>
              Add topic
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {topics.map((topic) => (
            <div key={topic.id} className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs text-white/60">
                  Topic
                  <Input
                    value={topic.topic}
                    onChange={(event) => updateTopicField(topic.id, "topic", event.target.value)}
                    className="mt-2"
                  />
                </label>
                <label className="text-xs text-white/60 md:col-span-2">
                  Keywords
                  <Input
                    value={topic.keywordsText}
                    onChange={(event) => updateTopicField(topic.id, "keywordsText", event.target.value)}
                    className="mt-2"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-3 text-xs text-white/60">
                  <Switch
                    checked={topic.enabled}
                    onChange={(event) => updateTopicField(topic.id, "enabled", event.target.checked)}
                  />
                  Enabled
                </label>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => saveTopic(topic)}
                  disabled={savingTopicId === topic.id}
                >
                  {savingTopicId === topic.id ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ))}
          {topics.length === 0 ? (
            <p className="text-sm text-white/60">No topics yet. Add your first tracked topic above.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">FAQ library</p>
            <p className="text-xs text-white/60">Answers here are injected into the chatbot context.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setDraftOpen((prev) => !prev)}>
            {draftOpen ? "Hide draft" : "New FAQ"}
          </Button>
        </div>

        {draftOpen ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/20 bg-neutral-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Draft FAQ</p>
            <div className="mt-3 grid gap-3">
              <label className="text-xs text-white/60">
                Question
                <Input
                  value={draftFaq.question}
                  onChange={(event) => setDraftFaq((prev) => ({ ...prev, question: event.target.value }))}
                  className="mt-2"
                />
              </label>
              <label className="text-xs text-white/60">
                Answer
                <Textarea
                  value={draftFaq.answer}
                  onChange={(event) => setDraftFaq((prev) => ({ ...prev, answer: event.target.value }))}
                  className="mt-2 min-h-[120px]"
                />
              </label>
              <div className="flex justify-end">
                <Button variant="primary" onClick={addFaqDraft} disabled={savingDraft}>
                  {savingDraft ? "Saving..." : "Save FAQ"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {faqs.map((faq) => (
            <div key={faq.id} className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4">
              <div className="grid gap-3">
                <label className="text-xs text-white/60">
                  Question
                  <Input
                    value={faq.question}
                    onChange={(event) =>
                      setFaqs((prev) =>
                        prev.map((item) =>
                          item.id === faq.id ? { ...item, question: event.target.value } : item
                        )
                      )
                    }
                    className="mt-2"
                  />
                </label>
                <label className="text-xs text-white/60">
                  Answer
                  <Textarea
                    value={faq.answer}
                    onChange={(event) =>
                      setFaqs((prev) =>
                        prev.map((item) =>
                          item.id === faq.id ? { ...item, answer: event.target.value } : item
                        )
                      )
                    }
                    className="mt-2 min-h-[120px]"
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => saveFaq(faq)}
                  disabled={savingFaqId === faq.id}
                >
                  {savingFaqId === faq.id ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ))}
          {faqs.length === 0 ? (
            <p className="text-sm text-white/60">No FAQs yet. Add one above to improve answers.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
