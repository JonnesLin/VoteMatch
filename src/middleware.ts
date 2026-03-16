import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rate limiting middleware for public API endpoints.
 * Uses a simple in-memory counter per IP with 60 req/min limit.
 *
 * Note: In production, use Redis-backed rate limiting for multi-instance deploys.
 * This in-memory implementation works for single-instance MVP.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup runs on each request (cheap — Map iteration is fast for small maps)
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export function middleware(request: NextRequest) {
  // Allow iframe embedding for /embed/* routes
  if (request.nextUrl.pathname.startsWith("/embed/")) {
    const response = NextResponse.next();
    response.headers.delete("X-Frame-Options");
    response.headers.set(
      "Content-Security-Policy",
      "frame-ancestors *"
    );
    return response;
  }

  // Only rate-limit API routes
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  cleanup();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || entry.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
    response.headers.set("X-RateLimit-Remaining", String(MAX_REQUESTS - 1));
    return response;
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  entry.count++;
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  response.headers.set("X-RateLimit-Remaining", String(MAX_REQUESTS - entry.count));
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/embed/:path*"],
};
