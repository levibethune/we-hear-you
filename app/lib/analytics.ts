import posthog from "posthog-js";

/**
 * Track a custom event in PostHog.
 */
export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    posthog.capture(event, properties);
  }
}

/**
 * Identify a user in PostHog (call after login).
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    posthog.identify(userId, properties);
  }
}

/**
 * Reset PostHog identity (call on logout).
 */
export function resetUser() {
  if (typeof window !== "undefined") {
    posthog.reset();
  }
}
