import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const campaignId = request.nextUrl.searchParams.get("campaign_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();
  let query = db
    .from("analysis_configs")
    .select("id, name, system_prompt, output_schema, model, is_active, created_at")
    .eq("is_active", true)
    .limit(1);

  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query.single();

  if (error) return NextResponse.json({ error: "No config found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, campaign_id, system_prompt, output_schema, model } = body;

  // Requires admin role to modify config
  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();

  let existingQuery = db
    .from("analysis_configs")
    .select("id")
    .eq("is_active", true);

  if (campaign_id) {
    existingQuery = existingQuery.eq("campaign_id", campaign_id);
  } else {
    existingQuery = existingQuery.eq("tenant_id", tenant_id);
  }

  const { data: existing } = await existingQuery.single();

  if (existing) {
    const { error } = await db
      .from("analysis_configs")
      .update({ system_prompt, output_schema, model: model ?? "claude-sonnet-4-6" })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  } else {
    const { error } = await db.from("analysis_configs").insert({
      tenant_id,
      ...(campaign_id ? { campaign_id } : {}),
      name: "Analysis Config",
      system_prompt,
      output_schema,
      model: model ?? "claude-sonnet-4-6",
    });
    if (error) return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
