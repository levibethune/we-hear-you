import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tenantId = params.get("tenant_id");
  const flowId = params.get("flow_id");
  const page = Math.max(1, parseInt(params.get("page") || "1"));
  const perPage = Math.min(50, Math.max(1, parseInt(params.get("per_page") || "20")));

  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();
  let query = db
    .from("flow_executions")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (flowId) query = query.eq("flow_id", flowId);

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ error: "Failed to fetch executions" }, { status: 500 });

  return NextResponse.json({
    executions: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
  });
}
