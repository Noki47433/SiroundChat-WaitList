export const BANNED_PHRASE_PATTERNS: RegExp[] = [
  /\btrusted local experts\b/i,
  /\btailored solutions\b/i,
  /\bindustry-leading\b/i,
  /\bseamless\b/i,
  /\bworld-class\b/i,
  /\bunmatched\b/i,
  /\bbest in class\b/i,
  /\bbest[- ]in[- ]class\b/i,
  /\bamazing\b/i,
  /\bwe specialize in providing\b/i,
  /\bfriendly and comfortable environment\b/i,
  /\bcustomer focused\b/i,
  /\breliable delivery with consistent quality\b/i,
  /\btop[- ]notch\b/i,
  /\btrusted partner\b/i,
  /\b(best|leading|unmatched|world[- ]class|top[- ]tier)\b(?![^.!?]{0,24}\d)/i
];

export const BANNED_PHRASE_LABELS = [
  "trusted local experts",
  "tailored solutions",
  "industry-leading",
  "seamless",
  "world-class",
  "unmatched",
  "best in class",
  "amazing",
  "we specialize in providing",
  "friendly and comfortable environment",
  "customer focused",
  "reliable delivery with consistent quality",
  "top-notch",
  "trusted partner",
  "vague superlative without metric"
];

export const BANNED_HIT_THRESHOLD = 0;

const extractStrings = (value: unknown, out: string[]) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => extractStrings(entry, out));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((entry) => extractStrings(entry, out));
  }
};

export type BannedHit = {
  phrase: string;
  value: string;
};

export const findBannedCopyHits = (value: unknown): BannedHit[] => {
  const strings: string[] = [];
  extractStrings(value, strings);
  const hits: BannedHit[] = [];

  strings.forEach((text) => {
    BANNED_PHRASE_PATTERNS.forEach((pattern, index) => {
      if (pattern.test(text)) {
        hits.push({
          phrase: BANNED_PHRASE_LABELS[index] ?? "banned phrase",
          value: text
        });
      }
    });
  });

  return hits;
};
