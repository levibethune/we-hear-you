import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { getAuthUser, isSuperAdmin, unauthorized, forbidden } from "../../../lib/dashboard-auth";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdmin(user.email)) return forbidden();

  const db = getServerClient();

  // Fetch tenants + counts in parallel (3 queries total, not 2N)
  const [tenantsResult, memberCounts, responseCounts] = await Promise.all([
    db.from("tenants").select("id, name, slug, allowed_domains, default_role, created_at").order("created_at"),
    db.from("tenant_members").select("tenant_id"),
    db.from("responses").select("tenant_id"),
  ]);

  // Count in JS — much faster than N+1 queries
  const memberMap: Record<string, number> = {};
  for (const m of memberCounts.data ?? []) {
    memberMap[m.tenant_id] = (memberMap[m.tenant_id] || 0) + 1;
  }

  const responseMap: Record<string, number> = {};
  for (const r of responseCounts.data ?? []) {
    responseMap[r.tenant_id] = (responseMap[r.tenant_id] || 0) + 1;
  }

  const results = (tenantsResult.data ?? []).map((t) => ({
    ...t,
    memberCount: memberMap[t.id] ?? 0,
    responseCount: responseMap[t.id] ?? 0,
  }));

  return NextResponse.json(results);
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdmin(user.email)) return forbidden();

  const body = await request.json();
  const { tenant_id, allowed_domains, default_role } = body;

  if (!tenant_id) {
    return NextResponse.json({ error: "tenant_id required" }, { status: 400 });
  }

  const db = getServerClient();
  const { error } = await db
    .from("tenants")
    .update({
      allowed_domains: allowed_domains ?? [],
      default_role: default_role ?? "admin",
    })
    .eq("id", tenant_id);

  if (error) return NextResponse.json({ error: "Failed to update tenant" }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdmin(user.email)) return forbidden();

  const body = await request.json();
  const { name, slug, allowed_domains, default_role, invite_emails } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }

  const db = getServerClient();

  // Create tenant — webhook secret stored encrypted at rest
  const webhookSecret = crypto.randomBytes(32).toString("hex");
  const { encrypt } = await import("../../../../lib/crypto/pii.js");
  const webhookSecretEncrypted = await encrypt(webhookSecret);
  const { data: tenant, error: tenantErr } = await db
    .from("tenants")
    .insert({
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      webhook_secret_encrypted: webhookSecretEncrypted,
      allowed_domains: allowed_domains ?? [],
      default_role: default_role ?? "admin",
    })
    .select("id, name, slug")
    .single();

  if (tenantErr) {
    return NextResponse.json({ error: "Failed to create organization. The slug may already be taken." }, { status: 400 });
  }

  // Create default analysis config
  await db.from("analysis_configs").insert({
    tenant_id: tenant.id,
    name: "Default Analysis",
    system_prompt: "You are a neutral analysis system. Your job is to analyze video transcription data.\n\nAnalyze the transcription and return structured results using the provided tool.",
    output_schema: {
      type: "object",
      properties: {
        themes: { type: "array", items: { type: "string" }, description: "2-5 short theme labels" },
        mood: { type: "string", description: "Single word describing overall emotional tone" },
        sentiment: { type: "string", enum: ["positive", "negative", "mixed", "neutral"] },
      },
      required: ["themes", "mood", "sentiment"],
    },
    model: "claude-sonnet-4-6",
  });

  // Process invite emails — create tenant_members for any existing auth users
  const inviteResults: { email: string; status: string }[] = [];
  if (invite_emails && Array.isArray(invite_emails)) {
    for (const email of invite_emails) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) continue;

      // Check if user exists in auth
      const { data: authUsers } = await db.auth.admin.listUsers();
      const existingUser = authUsers?.users?.find(
        (u) => u.email?.toLowerCase() === trimmed
      );

      if (existingUser) {
        // User exists — create membership
        const { error: memErr } = await db.from("tenant_members").insert({
          tenant_id: tenant.id,
          user_id: existingUser.id,
          role: "admin",
        });
        inviteResults.push({
          email: trimmed,
          status: memErr ? "failed" : "added",
        });
      } else {
        // User doesn't exist yet — they'll be auto-provisioned when they sign up
        // (if their domain is in allowed_domains)
        inviteResults.push({
          email: trimmed,
          status: "pending_signup",
        });
      }
    }
  }

  return NextResponse.json({
    tenant,
    inviteResults,
  });
}
