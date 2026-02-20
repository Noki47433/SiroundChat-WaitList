const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

type WindowState = {
  count: number;
  startedAt: number;
};

const state = new Map<string, WindowState>();

export function checkWebhookRateLimit(key: string) {
  const now = Date.now();
  const current = state.get(key);

  if (!current || now - current.startedAt > WINDOW_MS) {
    state.set(key, { count: 1, startedAt: now });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }

  current.count += 1;
  state.set(key, current);
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - current.count };
}
