import "server-only";
import { DomainError } from "@/lib/errors";

interface Window { count: number; resetAt: number }

const buckets = new Map<string, Window>();

/**
 * Fixed-window limiter held in process memory. Adequate for a single Node
 * instance; swap the Map for Redis/Upstash when running multiple instances.
 */
export function enforceRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  if (buckets.size > 10_000) {
    for (const [entry, window] of buckets) if (window.resetAt <= now) buckets.delete(entry);
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new DomainError("RATE_LIMITED", "Too many payment attempts. Wait a few minutes and try again.", { retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) });
  }
}

/** True when `key` has already used `limit` attempts in its current window (does not count this call). */
export function isRateLimited(key: string, limit: number, now = Date.now()) {
  const current = buckets.get(key);
  return Boolean(current && current.resetAt > now && current.count >= limit);
}

/** Counts one attempt against `key` without throwing (e.g. a failed sign-in). */
export function recordAttempt(key: string, windowMs: number, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else current.count += 1;
}

export const clearRateLimit = (key: string) => buckets.delete(key);

export const resetRateLimitsForTesting = () => buckets.clear();
