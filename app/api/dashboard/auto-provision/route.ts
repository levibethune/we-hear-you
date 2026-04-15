import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { getAuthUser, unauthorized } from "../../../lib/dashboard-auth";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user?.email) return unauthorized();

  const db = getServerClient();

  const domain = user.email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return NextResponse.json({ provisioned: false, reason: "no_domain" });
  }

  // Find all tenants with this domain in allowed_domains
  const { data: matchingTenants } = await db
    .from("tenants")
    .select("id, name, default_role, allowed_domains")
    .contains("allowed_domains", [domain]);

  if (!matchingTenants || matchingTenants.length === 0) {
    return NextResponse.json({ provisioned: false, reason: "no_matching_tenant" });
  }

  // Get existing memberships to avoid duplicates
  const { data: existingMembers } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id);

  const existingTenantIds = new Set((existingMembers ?? []).map((m) => m.tenant_id));

  // Only create memberships for tenants the user isn't already in
  const newMemberships = matchingTenants
    .filter((t) => !existingTenantIds.has(t.id))
    .map((t) => ({
      tenant_id: t.id,
      user_id: user.id,
      role: t.default_role || "viewer",
    }));

  if (newMemberships.length === 0) {
    return NextResponse.json({ provisioned: false, reason: "already_member" });
  }

  const { error } = await db.from("tenant_members").insert(newMemberships);

  if (error) {
    return NextResponse.json({ error: "Provisioning failed" }, { status: 500 });
  }

  return NextResponse.json({
    provisioned: true,
    tenants: newMemberships.map((m) => {
      const t = matchingTenants.find((t) => t.id === m.tenant_id);
      return { id: m.tenant_id, name: t?.name, role: m.role };
    }),
  });
}
