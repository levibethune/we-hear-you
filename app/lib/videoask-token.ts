import { getServerClient } from "./supabase-server";

interface TokenResult {
  token: string;
  connectionId: string;
}

/**
 * Get a valid VideoAsk access token for a tenant.
 * Auto-refreshes if the token is expired or if forceRefresh is true.
 * Returns null if no connection exists or refresh fails.
 */
export async function getVideoAskToken(
  tenantId: string,
  forceRefresh = false
): Promise<string | null> {
  const db = getServerClient();

  const { data: connection } = await db
    .from("oauth_connections")
    .select("id, access_token, refresh_token, token_expires_at")
    .eq("tenant_id", tenantId)
    .eq("provider", "videoask")
    .maybeSingle();

  if (!connection) return null;

  // Check if token is still valid (with 60s buffer)
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at)
    : null;

  // If no expiration is stored, assume it's expired (safer default)
  const isExpired = !expiresAt || expiresAt.getTime() - 60000 < Date.now();

  if (!isExpired && !forceRefresh) {
    return connection.access_token;
  }

  // Token expired or force refresh — try to get a new one
  if (!connection.refresh_token) return null;

  const refreshed = await refreshVideoAskToken(connection.id, connection.refresh_token);
  return refreshed?.token ?? null;
}

/**
 * Force-refresh a VideoAsk token using the refresh token.
 */
async function refreshVideoAskToken(
  connectionId: string,
  refreshToken: string
): Promise<TokenResult | null> {
  const clientId = process.env.VIDEOASK_CLIENT_ID!;
  const clientSecret = process.env.VIDEOASK_CLIENT_SECRET!;

  const tokenRes = await fetch("https://auth.videoask.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("VideoAsk token refresh failed:", tokenRes.status, errBody);
    return null;
  }

  const tokens = await tokenRes.json();

  const newExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const db = getServerClient();
  await db
    .from("oauth_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? refreshToken,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  return { token: tokens.access_token, connectionId };
}

/**
 * Make a VideoAsk API request with automatic token refresh on 401/403.
 */
const ALLOWED_HOSTNAMES = ["api.videoask.com"];

export async function videoAskFetch(
  tenantId: string,
  url: string
): Promise<Response | null> {
  // Prevent sending OAuth tokens to non-VideoAsk domains
  try {
    const parsed = new URL(url);
    if (!ALLOWED_HOSTNAMES.includes(parsed.hostname)) {
      console.error(`videoAskFetch blocked: ${parsed.hostname} not in allowlist`);
      return null;
    }
  } catch {
    return null;
  }

  let token = await getVideoAskToken(tenantId);
  if (!token) return null;

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // If unauthorized, try refreshing the token once and retry
  if (res.status === 401 || res.status === 403) {
    token = await getVideoAskToken(tenantId, true);
    if (!token) return null;

    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return res;
}
