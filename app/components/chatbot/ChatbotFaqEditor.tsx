// Summary: Secondary editor for managing FAQ entries used by the demo matcher; understand lightly unless changing FAQ UX.
'use client';

import { FaqItem, BusinessType } from "./chatbotTypes";
import { Trash2 } from "lucide-react";

type ChatbotFaqEditorProps = {
  faqs: FaqItem[];
  onChange: (faqs: FaqItem[]) => void;
  businessType: BusinessType;
};

export function ChatbotFaqEditor({ faqs, onChange, businessType }: ChatbotFaqEditorProps) {
  const handleUpdate = (id: string, field: keyof FaqItem, value: string) => {
    onChange(faqs.map((faq) => (faq.id === id ? { ...faq, [field]: value } : faq)));
  };

  const handleDelete = (id: string) => {
    onChange(faqs.filter((faq) => faq.id !== id));
  };

  const handleAdd = () => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `faq-${Date.now()}`;
    onChange([...faqs, { id, question: "New question", answer: "Type an answer here." }]);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-100">FAQ &amp; answers</p>
          <p className="text-xs text-slate-400 capitalize">Preset for {businessType.replace("_", " ")}</p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          + Add question
        </button>
      </div>

      <div className="space-y-3">
        {faqs.map((faq) => (
          <div key={faq.id} className="space-y-2 rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="flex items-start gap-2">
              <label className="w-full text-xs text-slate-300">
                Question
                <input
                  value={faq.question}
                  onChange={(event) => handleUpdate(faq.id, "question", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  placeholder="Question"
                />
              </label>
              <button
                type="button"
                onClick={() => handleDelete(faq.id)}
                className="mt-6 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                aria-label="Delete FAQ"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <label className="text-xs text-slate-300">
              Answer
              <textarea
                value={faq.answer}
                onChange={(event) => handleUpdate(faq.id, "answer", event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                placeholder="Answer"
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
