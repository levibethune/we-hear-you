import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { getAuthUser, isSuperAdmin, unauthorized, forbidden } from "../../../lib/dashboard-auth";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdmin(user.email)) return forbidden();

  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) return NextResponse.json({ error: "tenant_id required" }, { status: 400 });

  const db = getServerClient();

  const { data: members } = await db
    .from("tenant_members")
    .select("id, user_id, role, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at");

  // Get user emails for each member
  const { data: authUsers } = await db.auth.admin.listUsers();
  const userMap = new Map(
    (authUsers?.users ?? []).map((u) => [u.id, u.email])
  );

  const enriched = (members ?? []).map((m) => ({
    ...m,
    email: userMap.get(m.user_id) ?? "Unknown",
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdmin(user.email)) return forbidden();

  const body = await request.json();
  const { tenant_id, email, role } = body;

  if (!tenant_id || !email) {
    return NextResponse.json({ error: "tenant_id and email required" }, { status: 400 });
  }

  const validRoles = ["viewer", "admin", "owner"];
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const db = getServerClient();

  // Find the auth user by email — targeted lookup
  const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 });
  const targetUser = authUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
  );

  if (!targetUser) {
    return NextResponse.json({
      added: false,
      reason: "no_account",
      message: "No account found with that email. They\u2019ll be auto-provisioned when they sign up if their domain is allowed.",
    });
  }

  // Check if already a member
  const { data: existing } = await db
    .from("tenant_members")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("user_id", targetUser.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      added: false,
      reason: "already_member",
      message: "This person is already a member of this organization.",
    });
  }

  const { error } = await db.from("tenant_members").insert({
    tenant_id,
    user_id: targetUser.id,
    role: role ?? "admin",
  });

  if (error) {
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }

  return NextResponse.json({ added: true, email: targetUser.email, role: role ?? "admin" });
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdmin(user.email)) return forbidden();

  const body = await request.json();
  const { member_id, tenant_id, role } = body;

  if (!member_id || !tenant_id) {
    return NextResponse.json({ error: "member_id and tenant_id required" }, { status: 400 });
  }

  const validRoles = ["viewer", "admin", "owner"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const db = getServerClient();
  const { error } = await db
    .from("tenant_members")
    .update({ role })
    .eq("id", member_id)
    .eq("tenant_id", tenant_id);

  if (error) return NextResponse.json({ error: "Failed to update role" }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdmin(user.email)) return forbidden();

  const body = await request.json();
  const { member_id, tenant_id } = body;

  if (!member_id || !tenant_id) {
    return NextResponse.json({ error: "member_id and tenant_id required" }, { status: 400 });
  }

  const db = getServerClient();
  await db.from("tenant_members").delete().eq("id", member_id).eq("tenant_id", tenant_id);

  return NextResponse.json({ success: true });
}
