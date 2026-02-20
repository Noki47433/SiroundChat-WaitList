// Summary: Lightweight FAQ matcher for the demo chatbot; core to showing plausible answers without a real backend.
import { FaqItem } from "./chatbotTypes";

const punctuationRegex = /[^\w\s]/g;

// Normalizes text so comparisons are forgiving of punctuation/case.
function normalize(text: string): string {
  return text.toLowerCase().replace(punctuationRegex, " ").replace(/\s+/g, " ").trim();
}

export function findBestFaqMatch(input: string, faqs: FaqItem[]): FaqItem | null {
  if (!input.trim() || !faqs.length) return null;
  const normalizedInput = normalize(input);
  let best: { faq: FaqItem; score: number } | null = null;

  // Scores each FAQ by token overlap and short-circuits exact/containment matches.
  for (const faq of faqs) {
    const normalizedQuestion = normalize(faq.question);
    if (!normalizedQuestion) continue;
    if (normalizedQuestion.includes(normalizedInput) || normalizedInput.includes(normalizedQuestion)) {
      return faq;
    }

    const inputTokens = new Set(normalizedInput.split(" "));
    const questionTokens = new Set(normalizedQuestion.split(" "));
    let overlap = 0;
    inputTokens.forEach((token) => {
      if (questionTokens.has(token)) overlap += 1;
    });
    const score = overlap / Math.max(1, questionTokens.size);
    if (!best || score > best.score) {
      best = { faq, score };
    }
  }

  // Only accept loose matches above a small threshold to avoid irrelevant answers.
  if (best && best.score >= 0.25) {
    return best.faq;
  }

  return null;
}

export function getFallbackResponse(): string {
  // Default reply when no FAQ is similar enough; removing it leaves the demo blank.
  return "I’m not sure about that yet, but you can add this question to your FAQ so I can answer it next time.";
}
