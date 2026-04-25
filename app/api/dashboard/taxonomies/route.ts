import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const campaignId = request.nextUrl.searchParams.get("campaign_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();

  if (campaignId) {
    // Specific campaign — return its taxonomy
    const { data } = await db
      .from("taxonomies")
      .select("id, name, buckets, created_at")
      .eq("name", "Personas")
      .eq("campaign_id", campaignId)
      .maybeSingle();
    return NextResponse.json(data ?? { buckets: [] });
  }

  // All Campaigns — aggregate buckets across all campaigns' taxonomies
  const { data: all } = await db
    .from("taxonomies")
    .select("buckets")
    .eq("name", "Personas")
    .eq("tenant_id", tenantId);

  const seen = new Set<string>();
  const buckets: unknown[] = [];
  for (const t of all ?? []) {
    for (const b of (t.buckets || []) as { name: string }[]) {
      if (!b?.name || seen.has(b.name)) continue;
      seen.add(b.name);
      buckets.push(b);
    }
  }
  return NextResponse.json({ buckets });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, campaign_id, buckets } = body;

  // Requires admin role
  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();

  let existingQuery = db
    .from("taxonomies")
    .select("id")
    .eq("name", "Personas");

  if (campaign_id) {
    existingQuery = existingQuery.eq("campaign_id", campaign_id);
  } else {
    existingQuery = existingQuery.eq("tenant_id", tenant_id);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    await db.from("taxonomies").update({ buckets }).eq("id", existing.id);
  } else {
    await db.from("taxonomies").insert({ tenant_id, ...(campaign_id ? { campaign_id } : {}), name: "Personas", buckets });
  }

  // Auto-update analysis config with persona field
  let configQuery = db
    .from("analysis_configs")
    .select("*")
    .eq("is_active", true);

  if (campaign_id) {
    configQuery = configQuery.eq("campaign_id", campaign_id);
  } else {
    configQuery = configQuery.eq("tenant_id", tenant_id);
  }

  const { data: config } = await configQuery.single();

  if (config) {
    const schema = { ...config.output_schema } as {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };

    if (buckets.length > 0) {
      schema.properties.persona = {
        type: "string",
        enum: buckets.map((b: { name: string }) => b.name),
        description: "Classify this person into the most fitting persona",
      };
      if (!schema.required.includes("persona")) {
        schema.required.push("persona");
      }

      let prompt = config.system_prompt.replace(/\n\nPERSONA CLASSIFICATION:[\s\S]*$/, "");
      prompt += "\n\nPERSONA CLASSIFICATION:\nClassify this person into one of these personas:\n";
      for (const bucket of buckets) {
        prompt += `- ${bucket.name}: ${bucket.description}. Criteria: ${bucket.criteria}\n`;
      }
      prompt += "Choose the single best match based on the transcription content.";

      await db.from("analysis_configs").update({ output_schema: schema, system_prompt: prompt }).eq("id", config.id);
    } else {
      delete schema.properties.persona;
      schema.required = schema.required.filter((r: string) => r !== "persona");
      const prompt = config.system_prompt.replace(/\n\nPERSONA CLASSIFICATION:[\s\S]*$/, "");
      await db.from("analysis_configs").update({ output_schema: schema, system_prompt: prompt }).eq("id", config.id);
    }
  }

  return NextResponse.json({ success: true });
}
