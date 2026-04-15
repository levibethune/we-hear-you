import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, source_campaign_id, target_campaign_id, copy_analysis, copy_personas } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!source_campaign_id || !target_campaign_id) {
    return NextResponse.json({ error: "source_campaign_id and target_campaign_id are required" }, { status: 400 });
  }
  if (!copy_analysis && !copy_personas) {
    return NextResponse.json({ error: "At least one of copy_analysis or copy_personas must be true" }, { status: 400 });
  }

  const db = getServerClient();

  // Verify both campaigns belong to this tenant
  const { data: campaigns } = await db
    .from("campaigns")
    .select("id")
    .eq("tenant_id", tenant_id)
    .in("id", [source_campaign_id, target_campaign_id]);

  if (!campaigns || campaigns.length !== 2) {
    return NextResponse.json({ error: "One or both campaigns not found" }, { status: 404 });
  }

  if (copy_analysis) {
    const { data: sourceConfig } = await db
      .from("analysis_configs")
      .select("system_prompt, output_schema, model")
      .eq("campaign_id", source_campaign_id)
      .eq("is_active", true)
      .maybeSingle();

    if (sourceConfig) {
      // Deactivate existing config
      await db.from("analysis_configs")
        .update({ is_active: false })
        .eq("campaign_id", target_campaign_id)
        .eq("is_active", true);

      // Insert copy
      await db.from("analysis_configs").insert({
        tenant_id,
        campaign_id: target_campaign_id,
        name: "Copied config",
        system_prompt: sourceConfig.system_prompt,
        output_schema: sourceConfig.output_schema,
        model: sourceConfig.model,
        is_active: true,
      });
    }
  }

  if (copy_personas) {
    const { data: sourceTaxonomy } = await db
      .from("taxonomies")
      .select("name, buckets")
      .eq("campaign_id", source_campaign_id)
      .eq("name", "Personas")
      .maybeSingle();

    if (sourceTaxonomy) {
      await db.from("taxonomies")
        .delete()
        .eq("campaign_id", target_campaign_id)
        .eq("name", "Personas");

      await db.from("taxonomies").insert({
        tenant_id,
        campaign_id: target_campaign_id,
        name: sourceTaxonomy.name,
        buckets: sourceTaxonomy.buckets,
      });
    }
  }

  return NextResponse.json({ success: true });
}
