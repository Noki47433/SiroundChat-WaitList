const DAY_MS = 24 * 60 * 60 * 1000;

export type HealthScoreInputs = {
  conversationsCount: number;
  bookingsCount: number;
  missedIntentsCount: number;
  avgResponseTimeSec: number;
  errorEventsCount: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const computeHealthScore = (input: HealthScoreInputs) => {
  let score = 100;
  score -= Math.min(30, Math.max(0, input.errorEventsCount) * 2);
  score -= Math.min(25, Math.max(0, input.missedIntentsCount) * 3);

  if (input.avgResponseTimeSec > 3) {
    score -= Math.min(20, Math.max(0, input.avgResponseTimeSec - 3) * 2);
  }

  if (input.conversationsCount < 10) {
    score -= 10;
  }

  score += Math.min(15, Math.max(0, input.bookingsCount) * 3);
  return Math.round(clamp(score, 0, 100));
};

export const getWeekStartMonday = (date: Date) => {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = new Date(utc).getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(utc + diff * DAY_MS);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
};

export const toISODate = (date: Date) => date.toISOString().slice(0, 10);

export const getPreviousWeekStart = (weekStart: Date) => {
  const previous = new Date(weekStart.getTime() - 7 * DAY_MS);
  previous.setUTCHours(0, 0, 0, 0);
  return previous;
};

export const buildHealthSuggestions = (input: HealthScoreInputs) => {
  const suggestions: string[] = [];

  if (input.errorEventsCount > 0) {
    suggestions.push("We’re seeing errors. Check status / report bug.");
  }
  if (input.missedIntentsCount > 0) {
    suggestions.push("Enable follow-ups / improve booking flow.");
  }
  if (input.conversationsCount < 10) {
    suggestions.push("Add FAQ / add CTA to booking.");
  }

  if (!suggestions.length) {
    suggestions.push("Keep publishing updates and monitor weekly performance.");
  }

  return suggestions.slice(0, 3);
};

export const percentile50 = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

