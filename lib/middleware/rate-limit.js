import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit = null;

function getRatelimiter() {
  if (ratelimit) return ratelimit;

  // Upstash Redis — works in Vercel serverless (no persistent connections needed)
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "60 s"),
    prefix: "why_ratelimit",
  });

  return ratelimit;
}

/**
 * Per-tenant rate limiting.
 * Returns true if allowed, sends 429 and returns false if exceeded.
 */
export async function checkRateLimit(req, res, tenantId) {
  // Skip if Upstash is not configured (local dev)
  if (!process.env.UPSTASH_REDIS_REST_URL) return true;

  const limiter = getRatelimiter();
  const { success, remaining, reset } = await limiter.limit(tenantId);

  res.setHeader("X-RateLimit-Remaining", remaining.toString());
  res.setHeader("X-RateLimit-Reset", new Date(reset).toISOString());

  if (!success) {
    res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: new Date(reset).toISOString(),
    });
    return false;
  }

  return true;
}
