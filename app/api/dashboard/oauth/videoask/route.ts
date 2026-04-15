import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, getAuthUser, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

function signState(payload: object): string {
  const secret = process.env.MASTER_SETUP_KEY || process.env.ENCRYPTION_MASTER_KEY || "fallback";
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const data = JSON.stringify({ ...payload, nonce, timestamp });
  const signature = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return Buffer.from(JSON.stringify({ data, signature })).toString("base64url");
}

export function verifyState(state: string): { tenant_id: string; user_id: string } | null {
  try {
    const secret = process.env.MASTER_SETUP_KEY || process.env.ENCRYPTION_MASTER_KEY || "fallback";
    const { data, signature } = JSON.parse(Buffer.from(state, "base64url").toString());
    const expected = crypto.createHmac("sha256", secret).update(data).digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const parsed = JSON.parse(data);

    // Reject if older than 10 minutes
    if (Date.now() - parsed.timestamp > 600000) return null;

    return { tenant_id: parsed.tenant_id, user_id: parsed.user_id };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();
  const { data } = await db
    .from("oauth_connections")
    .select("id, provider, token_expires_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("provider", "videoask")
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  const expired = data.token_expires_at && new Date(data.token_expires_at) < new Date();

  return NextResponse.json({
    connected: true,
    expired,
    connectedAt: data.created_at,
    updatedAt: data.updated_at,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const clientId = process.env.VIDEOASK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "VideoAsk OAuth not configured" }, { status: 500 });
  }

  // Sign the state with HMAC — includes user_id and tenant_id
  const state = signState({ tenant_id, user_id: auth.user.id });

  const redirectUri = `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://app.wehearyou.io" : "http://localhost:3000"}/api/dashboard/oauth/videoask/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    scope: "openid profile email offline_access",
    audience: "https://api.videoask.com/",
  });

  const authorizeUrl = `https://auth.videoask.com/authorize?${params}`;

  return NextResponse.json({ authorizeUrl });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { tenant_id } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();
  await db
    .from("oauth_connections")
    .delete()
    .eq("tenant_id", tenant_id)
    .eq("provider", "videoask");

  return NextResponse.json({ success: true });
}
