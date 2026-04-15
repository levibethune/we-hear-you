import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getServerClient } from "./supabase-server";

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "levibethune@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

/**
 * Get the authenticated user from the request cookies.
 */
export async function getAuthUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Check if a user email is a super admin.
 */
export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

interface TenantAccess {
  role: string;
  tenantId: string;
}

/**
 * Verify that the authenticated user has access to the given tenant.
 * Returns the user's role if authorized, or sends a 403 and returns null.
 *
 * @param requiredRole - Minimum role needed. "viewer" allows all, "admin" requires admin or owner.
 */
export async function verifyTenantAccess(
  request: NextRequest,
  tenantId: string | null,
  requiredRole: "viewer" | "admin" | "owner" = "viewer"
): Promise<{ user: { id: string; email: string }; access: TenantAccess } | null> {
  const user = await getAuthUser(request);
  if (!user) return null;

  if (!tenantId) return null;

  // Super admins get owner access to everything
  if (isSuperAdmin(user.email)) {
    return {
      user: { id: user.id, email: user.email! },
      access: { role: "owner", tenantId },
    };
  }

  const db = getServerClient();
  const { data: membership } = await db
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!membership) return null;

  // Role hierarchy: owner > admin > viewer
  const roleLevel: Record<string, number> = { viewer: 0, admin: 1, owner: 2 };
  const userLevel = roleLevel[membership.role] ?? 0;
  const requiredLevel = roleLevel[requiredRole] ?? 0;

  if (userLevel < requiredLevel) return null;

  return {
    user: { id: user.id, email: user.email! },
    access: { role: membership.role, tenantId },
  };
}

/**
 * Helper to return a standardized unauthorized response.
 */
export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Helper to return a standardized forbidden response.
 */
export function forbidden(message = "You don\u2019t have access to this resource.") {
  return NextResponse.json({ error: message }, { status: 403 });
}
