type RateLimitBucket = {
  hits: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, RateLimitBucket>();

export class RateLimitError extends Error {
  constructor(message = "Too many attempts") {
    super(message);
    this.name = "RateLimitError";
  }
}

type RateLimitOptions = {
  key: string;
  limit: number;
  windowInSeconds: number;
};

export async function enforceRateLimit({ key, limit, windowInSeconds }: RateLimitOptions) {
  const bucket = memoryBuckets.get(key);
  const now = Date.now();
  if (!bucket || bucket.resetAt < now) {
    memoryBuckets.set(key, { hits: 1, resetAt: now + windowInSeconds * 1000 });
    return;
  }

  if (bucket.hits >= limit) {
    throw new RateLimitError();
  }

  bucket.hits += 1;
  memoryBuckets.set(key, bucket);
}
