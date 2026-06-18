/**
 * Rate limiting guardrail (Upstash Redis, sliding window).
 *
 * Protects the paid NVIDIA LLM endpoints from abuse and cost-based DoS.
 *
 * Behavior:
 *  - When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are configured,
 *    limits are enforced via a distributed sliding-window counter (works on
 *    serverless / multi-instance deployments).
 *  - When the Upstash env is absent, the limiter FAILS OPEN (allows the
 *    request) so local development keeps working. A one-time warning is logged.
 *
 * Two limiter tiers are exposed:
 *  - chat limiter:   per-identity (user id / anonymous id / IP) on LLM routes.
 *  - ip limiter:     coarse per-IP limit applied early in middleware.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getClientIP } from "@/lib/utils/anonymous-session";

export type RateLimitResult = {
  /** True when the request is allowed to proceed. */
  success: boolean;
  /** Configured request ceiling for the window. */
  limit: number;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Unix epoch ms when the window resets. */
  reset: number;
  /** Seconds the caller should wait before retrying (>= 0). */
  retryAfterSeconds: number;
  /** True when limiting was skipped because Upstash is not configured. */
  enforced: boolean;
};

function intFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

let redis: Redis | null | undefined;
let warnedDisabled = false;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redis = null;
    return redis;
  }
  redis = new Redis({ url, token });
  return redis;
}

let chatLimiter: Ratelimit | null | undefined;
let ipLimiter: Ratelimit | null | undefined;

function getChatLimiter(): Ratelimit | null {
  if (chatLimiter !== undefined) return chatLimiter;
  const client = getRedis();
  if (!client) {
    chatLimiter = null;
    return chatLimiter;
  }
  const max = intFromEnv("RATE_LIMIT_CHAT_MAX", 20);
  const windowS = intFromEnv("RATE_LIMIT_CHAT_WINDOW_S", 60);
  chatLimiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(max, `${windowS} s`),
    prefix: "aeris:rl:chat",
    analytics: false,
  });
  return chatLimiter;
}

function getIpLimiter(): Ratelimit | null {
  if (ipLimiter !== undefined) return ipLimiter;
  const client = getRedis();
  if (!client) {
    ipLimiter = null;
    return ipLimiter;
  }
  const max = intFromEnv("RATE_LIMIT_IP_MAX", 60);
  const windowS = intFromEnv("RATE_LIMIT_IP_WINDOW_S", 60);
  ipLimiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(max, `${windowS} s`),
    prefix: "aeris:rl:ip",
    analytics: false,
  });
  return ipLimiter;
}

function failOpen(limit: number): RateLimitResult {
  if (!warnedDisabled) {
    warnedDisabled = true;
    console.warn(
      "[guardrails] Upstash Redis not configured — rate limiting is DISABLED (fail-open). " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enforce limits.",
    );
  }
  return {
    success: true,
    limit,
    remaining: limit,
    reset: Date.now(),
    retryAfterSeconds: 0,
    enforced: false,
  };
}

async function evaluate(limiter: Ratelimit | null, key: string, fallbackLimit: number): Promise<RateLimitResult> {
  if (!limiter) return failOpen(fallbackLimit);
  try {
    const { success, limit, remaining, reset } = await limiter.limit(key);
    const retryAfterSeconds = success
      ? 0
      : Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    return { success, limit, remaining, reset, retryAfterSeconds, enforced: true };
  } catch (error) {
    // Never let a limiter outage take down the chat. Fail open but log.
    console.error("[guardrails] rate limiter error — failing open:", error);
    return failOpen(fallbackLimit);
  }
}

/**
 * Resolve a stable rate-limit identity for a request. Prefers the strongest
 * signal available: authenticated user id > anonymous session id > client IP.
 */
export function resolveRateLimitIdentity(
  request: Request,
  opts: { userId?: string | null; anonymousId?: string | null } = {},
): string {
  if (opts.userId) return `user:${opts.userId}`;
  if (opts.anonymousId) return `anon:${opts.anonymousId}`;
  const ip = getClientIP(request) ?? "unknown";
  return `ip:${ip}`;
}

/** Per-identity limit for LLM-touching routes. */
export function checkChatRateLimit(
  request: Request,
  opts: { userId?: string | null; anonymousId?: string | null } = {},
): Promise<RateLimitResult> {
  const key = resolveRateLimitIdentity(request, opts);
  return evaluate(getChatLimiter(), key, intFromEnv("RATE_LIMIT_CHAT_MAX", 20));
}

/** Coarse per-IP limit, intended for early middleware checks. */
export function checkIpRateLimit(request: Request): Promise<RateLimitResult> {
  const ip = getClientIP(request) ?? "unknown";
  return evaluate(getIpLimiter(), `ip:${ip}`, intFromEnv("RATE_LIMIT_IP_MAX", 60));
}

/** Standard headers to attach to a 429 (or any) rate-limited response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
  };
  if (!result.success) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }
  return headers;
}
