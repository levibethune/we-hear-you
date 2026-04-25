import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";
import { listCollections, listCollectionFields } from "../../../../../lib/integrations/webflow.js";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tenantId = params.get("tenant_id");
  const siteId = params.get("site_id");
  const collectionId = params.get("collection_id");

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

  if (collectionId) {
    const fields = await listCollectionFields(conn.access_token, collectionId);
    return NextResponse.json({ fields });
  }

  if (siteId) {
    const collections = await listCollections(conn.access_token, siteId);
    return NextResponse.json({ collections });
  }

  return NextResponse.json({ error: "site_id or collection_id required" }, { status: 400 });
}
