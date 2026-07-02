/**
 * In-memory sliding-window rate limiter.
 *
 * Keyed per route + caller identity (client IP + anonymousId). This works
 * correctly on a single serverless instance / long-lived Node process. On a
 * multi-instance deployment each instance keeps its own window, so the
 * effective limit is (configured limit x instance count).
 *
 * TODO: back this with Upstash Redis / Vercel KV for cross-instance accuracy
 * before scaling horizontally.
 */

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
};

type Bucket = number[]; // sorted-ish list of request timestamps (ms)

const buckets = new Map<string, Bucket>();

// Guard against unbounded growth of the map when many distinct keys appear.
const MAX_KEYS = 50_000;

function pruneOldest() {
  // Cheap eviction: drop ~10% of keys when we exceed the cap. FIFO-ish via
  // Map insertion order.
  const toDrop = Math.ceil(MAX_KEYS * 0.1);
  let dropped = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (++dropped >= toDrop) break;
  }
}

/**
 * Record a hit against `key` and report whether it is within `max` requests
 * per `windowMs`. Every call counts as a hit unless it is rejected.
 */
export function checkRateLimit(
  key: string,
  opts: { windowMs: number; max: number },
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_KEYS) pruneOldest();
    bucket = [];
    buckets.set(key, bucket);
  }

  // Drop timestamps outside the current window.
  while (bucket.length && bucket[0] <= windowStart) {
    bucket.shift();
  }

  if (bucket.length >= opts.max) {
    const oldest = bucket[0];
    const retryAfterMs = Math.max(0, oldest + opts.windowMs - now);
    return { allowed: false, limit: opts.max, remaining: 0, retryAfterMs };
  }

  bucket.push(now);
  return {
    allowed: true,
    limit: opts.max,
    remaining: Math.max(0, opts.max - bucket.length),
    retryAfterMs: 0,
  };
}

/**
 * Extract the best-effort client IP from proxy headers. Server-side only.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Build a stable rate-limit key for a route from the caller's IP + anonymousId.
 * Both are attacker-supplied, so this is a soft signal — combined they raise the
 * cost of casual spam without adding any friction to legitimate callers.
 */
export function clientRateKey(
  route: string,
  request: Request,
  anonymousId?: string | null,
): string {
  const ip = getClientIp(request);
  const anon = (anonymousId ?? "").slice(0, 64) || "-";
  return `${route}|${ip}|${anon}`;
}

/**
 * Standard 429 JSON response body + Retry-After header value (seconds).
 */
export function rateLimitRetryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil(result.retryAfterMs / 1000));
}
