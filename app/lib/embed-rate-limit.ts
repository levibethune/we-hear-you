import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

let limiter: Ratelimit | null = null;

function getLimiter() {
  if (limiter) return limiter;
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  limiter = new Ratelimit({
    redis,
    // 60 embed loads per minute per IP. A page with one embed comfortably
    // fits; scraping attempts hit the brake immediately.
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    prefix: "why_embed_ratelimit",
  });
  return limiter;
}

/**
 * IP-keyed rate limit for the public embed endpoint.
 * Returns true if the request is allowed; false if it should be blocked.
 * Skips the check if Upstash isn't configured.
 */
export async function checkEmbedRateLimit(): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return true;
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const { success } = await getLimiter().limit(ip);
  return success;
}
