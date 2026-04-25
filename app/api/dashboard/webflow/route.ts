import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";
import { validateToken } from "../../../../lib/integrations/webflow.js";

// GET — check if token exists
export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();
  const { data } = await db
    .from("oauth_connections")
    .select("id, created_at")
    .eq("tenant_id", tenantId)
    .eq("provider", "webflow")
    .maybeSingle();

  return NextResponse.json({ connected: !!data, connected_at: data?.created_at ?? null });
}

// POST — validate and save token
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, api_token } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!api_token?.trim()) {
    return NextResponse.json({ error: "API token is required" }, { status: 400 });
  }

  // Validate with Webflow
  const result = (await validateToken(api_token.trim())) as unknown as { valid: boolean; error?: string };
  if (!result.valid) {
    const detail = result.error ? ` (${result.error})` : "";
    return NextResponse.json({ error: `Invalid Webflow API token${detail}` }, { status: 400 });
  }

  const db = getServerClient();
  // Upsert by (tenant_id, provider)
  await db
    .from("oauth_connections")
    .upsert({
      tenant_id,
      provider: "webflow",
      access_token: api_token.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider" });

  return NextResponse.json({ success: true });
}

// DELETE — remove token
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
    .eq("provider", "webflow");

  return NextResponse.json({ success: true });
}
