import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  // Admin required to view keys
  const auth = await verifyTenantAccess(request, tenantId, "admin");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();
  const { data } = await db
    .from("api_keys")
    .select("id, key_prefix, name, scopes, is_active, expires_at, last_used_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, name, scopes } = body;

  // Admin required to create keys
  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!name) {
    return NextResponse.json({ error: "Key name is required" }, { status: 400 });
  }

  const keyBytes = crypto.randomBytes(32);
  const plainKey = `why_${keyBytes.toString("hex")}`;
  const keyPrefix = plainKey.slice(0, 8);
  const keyHash = await bcrypt.hash(plainKey, 12);

  const db = getServerClient();
  const { data, error } = await db
    .from("api_keys")
    .insert({
      tenant_id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
      scopes: scopes ?? ["ingest"],
    })
    .select("id, key_prefix, name, scopes, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create key" }, { status: 500 });

  return NextResponse.json({ ...data, key: plainKey });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { key_id, tenant_id } = body;

  // Admin required to revoke keys
  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();
  await db
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", key_id)
    .eq("tenant_id", tenant_id);

  return NextResponse.json({ success: true });
}
