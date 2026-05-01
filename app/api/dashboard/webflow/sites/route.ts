import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";
import { listSites } from "../../../../../lib/integrations/webflow.js";
import { readOAuthToken, OAUTH_TOKEN_SELECT } from "../../../../../lib/crypto/oauth-helpers.js";

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();
  const { data: conn } = await db
    .from("oauth_connections")
    .select(OAUTH_TOKEN_SELECT)
    .eq("tenant_id", tenantId)
    .eq("provider", "webflow")
    .maybeSingle();

  const accessToken = await readOAuthToken(conn, "access_token");
  if (!accessToken) {
    return NextResponse.json({ error: "Webflow not connected" }, { status: 400 });
  }

  const sites = await listSites(accessToken);
  return NextResponse.json({ sites });
}
