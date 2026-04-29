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

  // Enrich each execution with a human-readable label (person's name / email)
  // resolved from the trigger record. Most trigger records are responses;
  // older ones (pre-fix) may be person IDs, so we fall back to people directly.
  const recordIds = [...new Set((data ?? []).map((e) => e.trigger_record_id).filter(Boolean))] as string[];
  const labelByRecordId = new Map<string, string>();

  if (recordIds.length > 0) {
    const { data: responseRows } = await db
      .from("responses")
      .select("id, person:people(name, email)")
      .in("id", recordIds)
      .eq("tenant_id", tenantId);

    for (const r of responseRows ?? []) {
      const person = (r as { person?: { name?: string | null; email?: string | null } | null }).person;
      const label = person?.name || person?.email;
      if (label) labelByRecordId.set(r.id as string, label);
    }

    const unresolved = recordIds.filter((id) => !labelByRecordId.has(id));
    if (unresolved.length > 0) {
      const { data: peopleRows } = await db
        .from("people")
        .select("id, name, email")
        .in("id", unresolved)
        .eq("tenant_id", tenantId);
      for (const p of peopleRows ?? []) {
        const label = (p.name as string | null) || (p.email as string | null);
        if (label) labelByRecordId.set(p.id as string, label);
      }
    }
  }

  const executions = (data ?? []).map((e) => ({
    ...e,
    trigger_label: labelByRecordId.get(e.trigger_record_id) || null,
  }));

  return NextResponse.json({
    executions,
    total: count ?? 0,
    page,
    per_page: perPage,
  });
}
