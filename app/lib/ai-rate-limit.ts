import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

let limiter: Ratelimit | null = null;

function getLimiter() {
  if (limiter) return limiter;
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  limiter = new Ratelimit({
    redis,
    // 100 AI analyses per hour per tenant. Single re-analyze costs 1
    // token; bulk re-analyze costs 1 per response. Compromised admin
    // accounts or runaway scripts hit the brake fast.
    limiter: Ratelimit.slidingWindow(100, "1 h"),
    prefix: "why_ai_ratelimit",
  });
  return limiter;
}

/**
 * Check whether a tenant has AI budget left for `cost` analyses.
 * Returns null if allowed; otherwise a 429 NextResponse to return
 * directly from the route handler.
 *
 * Skips if Upstash isn't configured (local dev).
 */
export async function checkAIRateLimit(tenantId: string, cost = 1): Promise<NextResponse | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  const rl = getLimiter();
  const { success, remaining, reset } = await rl.limit(tenantId, { rate: cost });
  if (success) return null;
  return NextResponse.json(
    {
      error: "AI rate limit exceeded for this tenant. Try again later.",
      remaining,
      retry_after: new Date(reset).toISOString(),
    },
    { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
  );
}
