import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const campaignId = request.nextUrl.searchParams.get("campaign_id");

  const db = getServerClient();
  let query = db
    .from("flows")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (campaignId) {
    query = query.or(`campaign_id.eq.${campaignId},campaign_id.is.null`);
  }

  const { data } = await query;

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, campaign_id, name, description, trigger_on, conditions, condition_logic, action_type, action_config, category } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Flow name is required" }, { status: 400 });
  }

  // Validate category
  const validCategories = ["flow", "notification"];
  if (category && !validCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // Validate conditions structure
  const validFields = ["campaign", "sentiment", "mood", "persona", "themes", "source_type", "source_form_name", "transcription"];
  const validOperators = ["equals", "not_equals", "contains", "not_contains", "in", "not_in"];
  if (Array.isArray(conditions)) {
    for (const c of conditions) {
      if (c.field && !validFields.includes(c.field)) {
        return NextResponse.json({ error: `Invalid condition field: ${c.field}` }, { status: 400 });
      }
      if (c.operator && !validOperators.includes(c.operator)) {
        return NextResponse.json({ error: `Invalid condition operator: ${c.operator}` }, { status: 400 });
      }
    }
  }

  // Validate action_config per action_type
  const type = action_type || "webhook";
  if (type === "webhook" && !action_config?.url) {
    return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
  }
  if (type === "slack" && !action_config?.webhook_url) {
    return NextResponse.json({ error: "Slack webhook URL is required" }, { status: 400 });
  }
  if (type === "email_digest" && (!Array.isArray(action_config?.recipients) || action_config.recipients.length === 0)) {
    return NextResponse.json({ error: "At least one email recipient is required" }, { status: 400 });
  }

  const db = getServerClient();
  const { data, error } = await db
    .from("flows")
    .insert({
      tenant_id,
      ...(campaign_id ? { campaign_id } : {}),
      name: name.trim(),
      description: description?.trim() || null,
      trigger_on: trigger_on || "both",
      conditions: conditions || [],
      condition_logic: condition_logic || "all",
      action_type: type,
      action_config: action_config || {},
      category: category || "flow",
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create flow" }, { status: 500 });

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { flow_id, tenant_id, ...updates } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!flow_id) {
    return NextResponse.json({ error: "flow_id is required" }, { status: 400 });
  }

  const allowed = ["name", "description", "trigger_on", "conditions", "condition_logic", "action_type", "action_config", "category", "is_active"];
  const cleanUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (updates[key] !== undefined) cleanUpdates[key] = updates[key];
  }

  const db = getServerClient();
  const { data, error } = await db
    .from("flows")
    .update(cleanUpdates)
    .eq("id", flow_id)
    .eq("tenant_id", tenant_id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Failed to update flow" }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { flow_id, tenant_id } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();
  await db.from("flows").delete().eq("id", flow_id).eq("tenant_id", tenant_id);

  return NextResponse.json({ success: true });
}
