import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../../lib/supabase-server";
import { verifyState } from "../route";
import { buildEncryptedTokenColumns } from "../../../../../../lib/crypto/oauth-helpers.js";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code || !state) {
    const message = error || "Missing authorization code";
    return NextResponse.redirect(
      new URL(`/dashboard/settings/import?oauth_error=${encodeURIComponent(message)}`, request.url)
    );
  }

  // Verify the signed state — prevents CSRF and state forgery
  const stateData = verifyState(state);
  if (!stateData) {
    return NextResponse.redirect(
      new URL("/dashboard/settings/import?oauth_error=Invalid+or+expired+authorization", request.url)
    );
  }

  const { tenant_id: tenantId } = stateData;

  const clientId = process.env.VIDEOASK_CLIENT_ID!;
  const clientSecret = process.env.VIDEOASK_CLIENT_SECRET!;
  // Must match exactly what was sent in the authorize step
  const redirectUri = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? "https://app.wehearyou.io/api/dashboard/oauth/videoask/callback"
    : `${request.nextUrl.origin}/api/dashboard/oauth/videoask/callback`;

  const tokenRes = await fetch("https://auth.videoask.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("VideoAsk token exchange failed:", tokenRes.status, errBody, "redirect_uri:", redirectUri);
    return NextResponse.redirect(
      new URL("/dashboard/settings/import?oauth_error=Token+exchange+failed.+Please+try+again.", request.url)
    );
  }

  const tokens = await tokenRes.json();

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const db = getServerClient();
  const encryptedCols = await buildEncryptedTokenColumns({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
  });
  const { error: dbError } = await db.from("oauth_connections").upsert(
    {
      tenant_id: tenantId,
      provider: "videoask",
      ...encryptedCols,
      token_expires_at: expiresAt,
      scopes: tokens.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,provider" }
  );

  if (dbError) {
    console.error("Failed to store OAuth tokens:", dbError);
    return NextResponse.redirect(
      new URL("/dashboard/settings/import?oauth_error=Failed+to+save+connection", request.url)
    );
  }

  return NextResponse.redirect(
    new URL("/dashboard/settings/import?oauth_success=videoask", request.url)
  );
}
