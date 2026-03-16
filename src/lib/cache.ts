/**
 * Redis Caching Layer — CACHE-001, CACHE-002
 *
 * CACHE-001: Caches pre-generated question sets
 * CACHE-002: Caches match results for shareable result URLs
 */

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const globalForRedis = globalThis as unknown as { _redis?: Redis };

function getRedis(): Redis {
  if (globalForRedis._redis) return globalForRedis._redis;

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis._redis = redis;
  }

  return redis;
}

const TTL_QUESTIONS = 3600; // 1 hour — questions don't change frequently
const TTL_RESULTS = 86400; // 24 hours — results are immutable once created

/**
 * CACHE-001: Cache question sets by election ID.
 */
export async function getCachedQuestions(
  electionId: string
): Promise<unknown | null> {
  const redis = getRedis();
  const key = `questions:${electionId}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheQuestions(
  electionId: string,
  data: unknown
): Promise<void> {
  const redis = getRedis();
  const key = `questions:${electionId}`;
  await redis.setex(key, TTL_QUESTIONS, JSON.stringify(data));
}

/**
 * CACHE-002: Cache match results by session ID.
 */
export async function getCachedResults(
  sessionId: string
): Promise<unknown | null> {
  const redis = getRedis();
  const key = `results:${sessionId}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheResults(
  sessionId: string,
  data: unknown
): Promise<void> {
  const redis = getRedis();
  const key = `results:${sessionId}`;
  await redis.setex(key, TTL_RESULTS, JSON.stringify(data));
}

/**
 * Invalidate question cache when positions change.
 */
export async function invalidateQuestionCache(
  electionId: string
): Promise<void> {
  const redis = getRedis();
  await redis.del(`questions:${electionId}`);
}
