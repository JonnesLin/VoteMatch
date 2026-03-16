/**
 * Simple in-memory rate limiter for API endpoints.
 * Uses a sliding window per IP address.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute per IP

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 60_000);

export function checkRateLimit(
  ip: string
): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || entry.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (entry.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_REQUESTS - entry.count };
}

export function getRateLimitHeaders(
  result: ReturnType<typeof checkRateLimit>
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(MAX_REQUESTS),
    "X-RateLimit-Remaining": String(result.remaining),
  };
  if (result.retryAfterMs) {
    headers["Retry-After"] = String(Math.ceil(result.retryAfterMs / 1000));
  }
  return headers;
}
