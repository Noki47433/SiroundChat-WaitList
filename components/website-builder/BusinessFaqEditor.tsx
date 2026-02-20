"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  isLocal?: boolean;
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `faq-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function BusinessFaqEditor({ businessId, topic }: { businessId: string; topic?: string | null }) {
  const { push } = useToast();
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const seededRef = useRef(false);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    const load = async () => {
      if (!businessId) return;
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("business_faq_items")
        .select("id, question, answer")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) {
        push({ title: "Failed to load FAQs", message: error.message, variant: "error" });
      } else {
        setItems(
          (data ?? []).map((row: any) => ({
            id: row.id,
            question: row.question ?? "",
            answer: row.answer ?? "",
            isLocal: false
          }))
        );
      }
      setLoading(false);
    };
    void load();
  }, [businessId, push, supabase]);

  useEffect(() => {
    if (!topic || seededRef.current) return;
    seededRef.current = true;
    setItems((prev) => {
      const normalized = topic.toLowerCase();
      const exists = prev.some((item) => item.question.toLowerCase().includes(normalized));
      if (exists) return prev;
      return [
        { id: createId(), question: `Do you offer ${topic}?`, answer: "", isLocal: true },
        ...prev
      ];
    });
  }, [topic]);

  const handleAdd = () => {
    setItems((prev) => [...prev, { id: createId(), question: "", answer: "", isLocal: true }]);
  };

  const handleChange = (id: string, field: "question" | "answer", value: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleDelete = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    setItems((prev) => prev.filter((entry) => entry.id !== id));
    if (item.isLocal) return;

    const { error } = await (supabase as any).from("business_faq_items").delete().eq("id", id);
    if (error) {
      push({ title: "Failed to delete FAQ", message: error.message, variant: "error" });
    }
  };

  const handleSave = async () => {
    const incomplete = items.some((item) => !item.question.trim() || !item.answer.trim());
    if (incomplete) {
      push({ title: "Complete each FAQ", message: "Add both a question and answer before saving.", variant: "info" });
      return;
    }

    const payload = items.map((item) => ({
      id: item.id,
      business_id: businessId,
      question: item.question.trim(),
      answer: item.answer.trim()
    }));

    setSaving(true);
    const { data, error } = await (supabase as any)
      .from("business_faq_items")
      .upsert(payload, { onConflict: "id" })
      .select("id, question, answer");
    setSaving(false);

    if (error) {
      push({ title: "Failed to save FAQs", message: error.message, variant: "error" });
      return;
    }

    if (data) {
      const savedIds = new Set(data.map((row: any) => row.id));
      setItems((prev) =>
        prev.map((item) => (savedIds.has(item.id) ? { ...item, isLocal: false } : item))
      );
    }

    push({ title: "FAQs saved", message: "Your business info is updated.", variant: "success" });
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Business info & FAQs</p>
          <p className="text-xs text-white/60">Answer common questions so your bot can respond instantly.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleAdd} type="button">
            <Plus className="mr-1 h-4 w-4" />
            Add FAQ
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving} type="button">
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-white/60">Loading FAQs...</p> : null}

      {items.length === 0 && !loading ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No FAQs yet. Add your first answer to reduce repeat questions.
        </p>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <label className="text-xs text-white/60">
                  Question
                  <Input
                    value={item.question}
                    onChange={(event) => handleChange(item.id, "question", event.target.value)}
                    placeholder="What do customers ask?"
                    className="mt-1"
                  />
                </label>
                <label className="text-xs text-white/60">
                  Answer
                  <Textarea
                    value={item.answer}
                    onChange={(event) => handleChange(item.id, "answer", event.target.value)}
                    placeholder="Write a concise answer your bot can use."
                    rows={3}
                    className="mt-1"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="mt-6 rounded-xl border border-white/10 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Delete FAQ"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
