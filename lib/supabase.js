import { createClient } from "@supabase/supabase-js";

let serviceClient = null;

/**
 * Get the Supabase service client (bypasses RLS).
 * Used by server-side code that handles its own tenant scoping.
 */
export function getServiceClient() {
  if (serviceClient) return serviceClient;
  serviceClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  return serviceClient;
}

// Default export for backward compatibility with legacy webhook
// Uses a proxy so the client initializes lazily (not at import time)
export default new Proxy({}, {
  get(_, prop) {
    return getServiceClient()[prop];
  },
});
