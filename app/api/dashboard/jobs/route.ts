import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, getAuthUser, unauthorized, forbidden } from "../../../lib/dashboard-auth";

/**
 * GET — List active/recent jobs for a tenant
 * POST — Create a new background job
 */

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const campaignId = request.nextUrl.searchParams.get("campaign_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();

  // Get active + recently completed jobs (last hour)
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  let query = db
    .from("jobs")
    .select("id, type, status, progress, result, error, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .or(`status.in.(pending,processing),updated_at.gte.${oneHourAgo}`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (campaignId) query = query.eq("campaign_id", campaignId);

  const { data } = await query;

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, campaign_id, type, params } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const validTypes = ["import_csv", "import_links", "reanalyze", "bulk_reanalyze"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid job type" }, { status: 400 });
  }

  const db = getServerClient();

  // Check for existing active job of same type
  const { data: existing } = await db
    .from("jobs")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("type", type)
    .in("status", ["pending", "processing"])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "A job of this type is already running" }, { status: 409 });
  }

  const { data: job, error } = await db
    .from("jobs")
    .insert({
      tenant_id,
      ...(campaign_id ? { campaign_id } : {}),
      type,
      status: "pending",
      params: params ?? {},
      progress: { current: 0, total: 0, imported: 0, skipped: 0, failed: 0 },
      created_by: auth.user.id,
    })
    .select("id, type, status")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  return NextResponse.json(job);
}
