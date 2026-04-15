import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

function generateSlug(): string {
  // 16 chars, URL-safe, hard to guess
  return crypto.randomBytes(12).toString("base64url");
}

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const campaignId = request.nextUrl.searchParams.get("campaign_id");

  const db = getServerClient();
  let query = db
    .from("video_feeds")
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
  const { tenant_id, campaign_id, name, description, topic, conditions, condition_logic, safety_required } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Feed name is required" }, { status: 400 });
  }

  const db = getServerClient();
  const { data, error } = await db
    .from("video_feeds")
    .insert({
      tenant_id,
      ...(campaign_id ? { campaign_id } : {}),
      slug: generateSlug(),
      name: name.trim(),
      description: description?.trim() || null,
      topic: topic?.trim() || null,
      conditions: conditions || [],
      condition_logic: condition_logic || "all",
      safety_required: safety_required || { no_pii: true, no_profanity: true, no_hate_speech: true, on_topic: true },
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create feed" }, { status: 500 });

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { feed_id, tenant_id, ...updates } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!feed_id) {
    return NextResponse.json({ error: "feed_id is required" }, { status: 400 });
  }

  const allowed = ["name", "description", "topic", "conditions", "condition_logic", "safety_required", "is_active"];
  const cleanUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (updates[key] !== undefined) cleanUpdates[key] = updates[key];
  }

  const db = getServerClient();
  const { data, error } = await db
    .from("video_feeds")
    .update(cleanUpdates)
    .eq("id", feed_id)
    .eq("tenant_id", tenant_id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Failed to update feed" }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { feed_id, tenant_id } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();
  await db.from("video_feeds").delete().eq("id", feed_id).eq("tenant_id", tenant_id);

  return NextResponse.json({ success: true });
}
