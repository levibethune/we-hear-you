import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, source_campaign_id, new_name } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!source_campaign_id || !new_name?.trim()) {
    return NextResponse.json({ error: "source_campaign_id and new_name are required" }, { status: 400 });
  }

  const db = getServerClient();

  // Fetch source campaign
  const { data: source } = await db
    .from("campaigns")
    .select("*")
    .eq("id", source_campaign_id)
    .eq("tenant_id", tenant_id)
    .single();

  if (!source) return NextResponse.json({ error: "Source campaign not found" }, { status: 404 });

  // Create the duplicate via the main campaigns POST endpoint logic
  const slug = new_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
    + "-" + Date.now().toString(36).slice(-4);

  const { data: newCampaign, error } = await db
    .from("campaigns")
    .insert({
      tenant_id,
      name: new_name.trim(),
      slug,
      description: source.description,
      form_names: [], // Don't copy form_names — user should configure
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });

  // Copy analysis_config
  const { data: sourceConfig } = await db
    .from("analysis_configs")
    .select("system_prompt, output_schema, model")
    .eq("campaign_id", source_campaign_id)
    .eq("is_active", true)
    .maybeSingle();

  if (sourceConfig) {
    await db.from("analysis_configs").insert({
      tenant_id,
      campaign_id: newCampaign.id,
      name: "Default",
      system_prompt: sourceConfig.system_prompt,
      output_schema: sourceConfig.output_schema,
      model: sourceConfig.model,
      is_active: true,
    });
  }

  // Copy taxonomy
  const { data: sourceTaxonomy } = await db
    .from("taxonomies")
    .select("name, buckets")
    .eq("campaign_id", source_campaign_id)
    .eq("name", "Personas")
    .maybeSingle();

  if (sourceTaxonomy) {
    await db.from("taxonomies").insert({
      tenant_id,
      campaign_id: newCampaign.id,
      name: sourceTaxonomy.name,
      buckets: sourceTaxonomy.buckets,
    });
  }

  return NextResponse.json(newCampaign);
}
