import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

// GET /api/dashboard/notifications?tenant_id=...&unread_only=true
export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const campaignId = request.nextUrl.searchParams.get("campaign_id");
  const unreadOnly = request.nextUrl.searchParams.get("unread_only") === "true";

  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();
  let query = db
    .from("in_app_notifications")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (campaignId) query = query.eq("campaign_id", campaignId);

  const { data } = await query;

  let notifications = data ?? [];
  if (unreadOnly) {
    notifications = notifications.filter((n) => !n.read_by?.includes(auth.user.id));
  }

  const unreadCount = (data ?? []).filter((n) => !n.read_by?.includes(auth.user.id)).length;

  return NextResponse.json({ notifications, unreadCount });
}

// POST /api/dashboard/notifications  { tenant_id, notification_id?, mark_all? }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, notification_id, mark_all } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "viewer");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();

  if (mark_all) {
    // Mark all notifications for this tenant as read by this user
    const { data: all } = await db
      .from("in_app_notifications")
      .select("id, read_by")
      .eq("tenant_id", tenant_id);

    for (const n of all ?? []) {
      const readBy = Array.isArray(n.read_by) ? n.read_by : [];
      if (!readBy.includes(auth.user.id)) {
        await db
          .from("in_app_notifications")
          .update({ read_by: [...readBy, auth.user.id] })
          .eq("id", n.id);
      }
    }

    return NextResponse.json({ success: true });
  }

  if (!notification_id) {
    return NextResponse.json({ error: "notification_id required" }, { status: 400 });
  }

  const { data: existing } = await db
    .from("in_app_notifications")
    .select("read_by")
    .eq("id", notification_id)
    .eq("tenant_id", tenant_id)
    .single();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const readBy = Array.isArray(existing.read_by) ? existing.read_by : [];
  if (!readBy.includes(auth.user.id)) {
    await db
      .from("in_app_notifications")
      .update({ read_by: [...readBy, auth.user.id] })
      .eq("id", notification_id);
  }

  return NextResponse.json({ success: true });
}
