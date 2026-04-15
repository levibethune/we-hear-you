import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const includeArchived = request.nextUrl.searchParams.get("include_archived") === "true";

  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();
  let query = db
    .from("campaigns")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data } = await query;
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, name, description, form_names } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }

  const db = getServerClient();

  // Generate unique slug
  let slug = slugify(name);
  const { data: existing } = await db
    .from("campaigns")
    .select("slug")
    .eq("tenant_id", tenant_id)
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  // Create campaign
  const { data: campaign, error } = await db
    .from("campaigns")
    .insert({
      tenant_id,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      form_names: form_names || [],
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });

  // Clone the default campaign's analysis_config
  const { data: defaultCampaign } = await db
    .from("campaigns")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("is_default", true)
    .single();

  if (defaultCampaign) {
    const { data: sourceConfig } = await db
      .from("analysis_configs")
      .select("system_prompt, output_schema, model")
      .eq("campaign_id", defaultCampaign.id)
      .eq("is_active", true)
      .maybeSingle();

    if (sourceConfig) {
      await db.from("analysis_configs").insert({
        tenant_id,
        campaign_id: campaign.id,
        name: "Default",
        system_prompt: sourceConfig.system_prompt,
        output_schema: sourceConfig.output_schema,
        model: sourceConfig.model,
        is_active: true,
      });
    }

    // Clone taxonomy
    const { data: sourceTaxonomy } = await db
      .from("taxonomies")
      .select("name, buckets")
      .eq("campaign_id", defaultCampaign.id)
      .eq("name", "Personas")
      .maybeSingle();

    if (sourceTaxonomy) {
      await db.from("taxonomies").insert({
        tenant_id,
        campaign_id: campaign.id,
        name: sourceTaxonomy.name,
        buckets: sourceTaxonomy.buckets,
      });
    }
  }

  return NextResponse.json(campaign);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { campaign_id, tenant_id, ...updates } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!campaign_id) {
    return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
  }

  const allowed = ["name", "description", "form_names", "is_archived"];
  const cleanUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (updates[key] !== undefined) cleanUpdates[key] = updates[key];
  }

  const db = getServerClient();
  const { data, error } = await db
    .from("campaigns")
    .update(cleanUpdates)
    .eq("id", campaign_id)
    .eq("tenant_id", tenant_id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { campaign_id, tenant_id } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();

  // Check: can't delete if it has responses
  const { count } = await db
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign_id);

  if (count && count > 0) {
    return NextResponse.json({ error: `Cannot delete a campaign with ${count} responses. Archive it instead.` }, { status: 400 });
  }

  await db.from("campaigns").delete().eq("id", campaign_id).eq("tenant_id", tenant_id);
  return NextResponse.json({ success: true });
}
