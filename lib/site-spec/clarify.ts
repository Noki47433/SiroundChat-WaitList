/**
 * The 0–3 clarification engine.
 *
 * Clarifications are a **completeness mechanism, not a wizard**. The system asks
 * only when the missing answer would materially change the site, never asks
 * something Business or Knowledge already answers, and never asks the owner to
 * choose implementation jargon.
 *
 * The engine is deterministic and model-free: given the same brief it produces
 * the same questions, in the same order. That is what makes "why did it ask me
 * that?" an answerable question, and it means the zero-question path can be
 * proved rather than hoped for.
 *
 * Every question carries a `chosenForYou` default, so skipping is always a real
 * option and the resulting decision is recorded rather than left implicit.
 */
import type { GenerationBrief } from "@/lib/site-spec/brief";

// ─────────────────────────────────────────────────────────────────────────────
// Shape
// ─────────────────────────────────────────────────────────────────────────────

export const CLARIFICATION_TOPICS = ["mood", "primaryAction", "imagery", "team"] as const;
export type ClarificationTopic = (typeof CLARIFICATION_TOPICS)[number];

export type ClarificationOption = {
  /** Stable id used when recording the answer. */
  id: string;
  label: string;
  /** One line of plain help. Never jargon. */
  hint?: string;
};

export type ClarificationQuestion = {
  topic: ClarificationTopic;
  /** Asked in the owner's language, about their business — not about the system. */
  question: string;
  /** Why it is being asked, in one line. */
  sub: string;
  options: ClarificationOption[];
  /** Used verbatim when the owner skips. */
  defaultOptionId: string;
};

export type ClarificationAnswer = {
  topic: ClarificationTopic;
  optionId: string;
  answerLabel: string;
  /** True when the owner skipped and the system decided. Recorded, not hidden. */
  chosenForYou: boolean;
};

export const MAX_CLARIFICATIONS = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Signals already present in what the owner said
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Words that already commit to a visual direction. If the request contains one,
 * asking "what should it feel like?" would be asking something already answered.
 */
const MOOD_SIGNALS = [
  "dark", "moody", "premium", "luxury", "luxurious", "elegant", "sophisticated",
  "clean", "minimal", "minimalist", "simple", "bright", "airy", "light",
  "warm", "cosy", "cozy", "classic", "traditional", "rustic",
  "bold", "loud", "playful", "fun", "colourful", "colorful",
  "editorial", "magazine", "modern", "contemporary", "sleek", "calm", "soft"
];

/** Words that commit to what visitors should do first. */
const ENQUIRY_SIGNALS = ["enquiry", "enquire", "inquiry", "inquire", "quote", "quotes", "brief", "proposal"];
const BOOKING_SIGNALS = ["book", "booking", "appointment", "appointments", "reserve", "reservation", "schedule"];

/** Words that commit to an imagery approach. */
const IMAGERY_SIGNALS = ["photo", "photos", "photography", "gallery", "portfolio", "images", "pictures", "visual"];

/** Words that commit to showing people. */
const TEAM_SIGNALS = ["team", "staff", "barbers", "stylists", "practitioners", "crew", "who we are", "our people"];

const mentions = (request: string, words: string[]): boolean => {
  const haystack = ` ${request.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ")} `;
  return words.some((word) => haystack.includes(` ${word} `));
};

// ─────────────────────────────────────────────────────────────────────────────
// The questions
// ─────────────────────────────────────────────────────────────────────────────

type Candidate = {
  /** Higher is more material to the finished site. */
  weight: number;
  question: ClarificationQuestion;
  /** Whether this question is worth asking at all, given the brief. */
  relevant: (brief: GenerationBrief) => boolean;
};

const MOOD_QUESTION: ClarificationQuestion = {
  topic: "mood",
  question: "What should the website feel like?",
  sub: "This decides the whole visual direction — everything else I can work out.",
  options: [
    { id: "dark_premium", label: "Dark & premium", hint: "Moody, confident, night-time" },
    { id: "clean_modern", label: "Clean & modern", hint: "Bright, simple, lots of air" },
    { id: "warm_classic", label: "Warm & classic", hint: "Traditional, softer, welcoming" },
    { id: "surprise", label: "Surprise me", hint: "I'll pick what suits your trade" }
  ],
  defaultOptionId: "surprise"
};

const ACTION_QUESTION: ClarificationQuestion = {
  topic: "primaryAction",
  question: "What should visitors do first?",
  sub: "I put this front and centre and shape the page around it.",
  options: [
    { id: "book", label: "Book an appointment" },
    { id: "enquire", label: "Send an enquiry" },
    { id: "call", label: "Call you" },
    { id: "browse", label: "Browse what you offer" }
  ],
  defaultOptionId: "book"
};

const IMAGERY_QUESTION: ClarificationQuestion = {
  topic: "imagery",
  question: "How should the pictures work?",
  sub: "You haven't uploaded photos yet, so I'll start with artwork you can replace later.",
  options: [
    { id: "photo_led", label: "Photography-led", hint: "Big images, gallery up front" },
    { id: "balanced", label: "A few strong images", hint: "Words do most of the work" },
    { id: "type_led", label: "Mostly type", hint: "Restrained, editorial" }
  ],
  defaultOptionId: "balanced"
};

const TEAM_QUESTION: ClarificationQuestion = {
  topic: "team",
  question: "Should your team be on the website?",
  sub: "You have people in your business record. This changes the page structure, so I won't assume.",
  options: [
    { id: "yes", label: "Yes, show them" },
    { id: "no", label: "No, keep it about the work" }
  ],
  defaultOptionId: "yes"
};

const CANDIDATES: Candidate[] = [
  {
    weight: 100,
    question: MOOD_QUESTION,
    // The single most material decision — asked unless already stated.
    relevant: (brief) => !mentions(brief.request, MOOD_SIGNALS)
  },
  {
    weight: 80,
    question: ACTION_QUESTION,
    relevant: (brief) => {
      // Already said what they want visitors to do.
      if (mentions(brief.request, [...BOOKING_SIGNALS, ...ENQUIRY_SIGNALS])) return false;
      // No booking engine and nothing to book: enquiry is the only honest
      // action, so there is nothing to ask.
      if (!brief.shape.bookingAvailable) return false;
      // A booking engine with nothing bookable is genuinely ambiguous.
      if (brief.shape.serviceCount === 0) return true;
      // Otherwise "Book" is the obvious default and asking wastes a question.
      return false;
    }
  },
  {
    weight: 70,
    question: IMAGERY_QUESTION,
    relevant: (brief) => {
      if (mentions(brief.request, IMAGERY_SIGNALS)) return false;
      // With real photographs available the system can just use them.
      return brief.shape.ownedImageCount === 0;
    }
  },
  {
    weight: 60,
    question: TEAM_QUESTION,
    relevant: (brief) => {
      if (mentions(brief.request, TEAM_SIGNALS)) return false;
      // One person is not a "team" section; a crowd is not a question.
      return brief.shape.teamCount >= 2 && brief.shape.teamCount <= 8;
    }
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// The engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which questions still need asking, given what is already known and what has
 * already been answered.
 *
 * Returns between zero and three. Answered topics collapse and are never
 * re-asked unless something makes them relevant again — which, because
 * relevance is a pure function of the brief, happens only when the brief itself
 * changes.
 */
export const nextClarifications = (
  brief: GenerationBrief,
  answered: ClarificationAnswer[] = []
): ClarificationQuestion[] => {
  const done = new Set(answered.map((answer) => answer.topic));

  return CANDIDATES.filter((candidate) => !done.has(candidate.question.topic))
    .filter((candidate) => candidate.relevant(brief))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_CLARIFICATIONS - answered.length)
    .map((candidate) => candidate.question);
};

/** Record an answer the owner gave. */
export const answerClarification = (
  question: ClarificationQuestion,
  optionId: string
): ClarificationAnswer => {
  const option = question.options.find((candidate) => candidate.id === optionId);
  if (!option) return skipClarification(question);
  return {
    topic: question.topic,
    optionId: option.id,
    answerLabel: option.label,
    chosenForYou: false
  };
};

/**
 * Record a skip. The decision is still made and still written down — the owner
 * is told what was chosen for them rather than left wondering.
 */
export const skipClarification = (question: ClarificationQuestion): ClarificationAnswer => {
  const option =
    question.options.find((candidate) => candidate.id === question.defaultOptionId) ??
    question.options[0];
  return {
    topic: question.topic,
    optionId: option.id,
    answerLabel: option.label,
    chosenForYou: true
  };
};

/**
 * Everything the owner has settled, in the approved one-line summary treatment:
 * "Dark & premium · Book an appointment · chosen for you: A few strong images".
 */
export const summariseDecisions = (answers: ClarificationAnswer[]): string =>
  answers
    .map((answer) => (answer.chosenForYou ? `chosen for you: ${answer.answerLabel}` : answer.answerLabel))
    .join(" · ");

/**
 * Fill in every remaining question without asking. Used when the owner says
 * "just build it", and when generation proceeds after a skip.
 */
export const decideRemaining = (
  brief: GenerationBrief,
  answered: ClarificationAnswer[] = []
): ClarificationAnswer[] => {
  const result = [...answered];
  let pending = nextClarifications(brief, result);
  // Bounded: each pass records at least one topic, and there are four topics.
  while (pending.length) {
    result.push(skipClarification(pending[0]));
    pending = nextClarifications(brief, result);
  }
  return result;
};
