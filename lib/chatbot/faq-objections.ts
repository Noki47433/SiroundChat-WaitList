import { normalizeText } from "@/lib/notifications/detectors";

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  keywords?: string[] | null;
};

export type ObjectionScript = {
  id: string;
  objection_key: "too_expensive" | "dont_need" | "call_only" | "not_trust_ai";
  response_text: string;
  phrases?: string[] | null;
};

const DEFAULT_OBJECTION_PHRASES: Record<ObjectionScript["objection_key"], string[]> = {
  too_expensive: ["too expensive", "cost too much", "price is high", "expensive"],
  dont_need: ["dont need", "do not need", "no need", "not needed"],
  call_only: ["call only", "prefer phone", "want to call", "phone only"],
  not_trust_ai: ["dont trust ai", "do not trust ai", "not trust", "ai is risky"]
};

const normalizeList = (values?: string[] | null) => (values ?? []).map((value) => normalizeText(value)).filter(Boolean);

export function matchFaq(message: string, faqEntries: FaqEntry[]): FaqEntry | null {
  const normalized = normalizeText(message);
  if (!normalized) return null;

  const messageTokens = new Set(normalized.split(" ").filter(Boolean));

  let best: { entry: FaqEntry; score: number } | null = null;

  for (const entry of faqEntries) {
    const questionNormalized = normalizeText(entry.question);
    const answerNormalized = normalizeText(entry.answer);
    const keywordList = normalizeList(entry.keywords);

    let score = 0;

    if (questionNormalized && normalized.includes(questionNormalized)) {
      score += 100;
    }

    if (questionNormalized && questionNormalized.includes(normalized)) {
      score += 35;
    }

    for (const keyword of keywordList) {
      if (keyword.includes(" ")) {
        if (normalized.includes(keyword)) score += 25;
      } else if (messageTokens.has(keyword)) {
        score += 20;
      }
    }

    const questionTokens = questionNormalized.split(" ").filter((token) => token.length > 2);
    const overlap = questionTokens.filter((token) => messageTokens.has(token)).length;
    score += overlap * 8;

    if (score <= 0 && answerNormalized && normalized.includes(answerNormalized)) {
      score += 12;
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }

  return best?.score && best.score >= 16 ? best.entry : null;
}

export function matchObjection(message: string, scripts: ObjectionScript[]): ObjectionScript | null {
  const normalized = normalizeText(message);
  if (!normalized) return null;

  for (const script of scripts) {
    const configured = normalizeList(script.phrases);
    const phrases = configured.length ? configured : DEFAULT_OBJECTION_PHRASES[script.objection_key];

    const matched = phrases.some((phrase) => {
      const normalizedPhrase = normalizeText(phrase);
      if (!normalizedPhrase) return false;
      return normalized.includes(normalizedPhrase);
    });

    if (matched) {
      return script;
    }
  }

  return null;
}
