import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";
import { listSites } from "../../../../../lib/integrations/webflow.js";

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();
  const { data: conn } = await db
    .from("oauth_connections")
    .select("access_token")
    .eq("tenant_id", tenantId)
    .eq("provider", "webflow")
    .maybeSingle();

  if (!conn?.access_token) {
    return NextResponse.json({ error: "Webflow not connected" }, { status: 400 });
  }

  const sites = await listSites(conn.access_token);
  return NextResponse.json({ sites });
}
