import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tenantId = params.get("tenant_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const page = Math.max(1, parseInt(params.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(params.get("per_page") ?? "25")));
  const persona = params.get("persona");
  const sentiment = params.get("sentiment");
  const mood = params.get("mood");
  const search = params.get("search");
  const sortBy = params.get("sort_by") ?? "updated_at";
  const sortDir = params.get("sort_dir") === "asc" ? true : false;

  const campaignId = params.get("campaign_id");

  const db = getServerClient();
  const showHidden = params.get("show_hidden") === "true";

  const allowedSortCols = ["name", "persona", "latest_mood", "latest_sentiment", "response_count", "last_responded_at", "updated_at"];
  const safeSort = allowedSortCols.includes(sortBy) ? sortBy : "updated_at";

  let query = db
    .from("people")
    .select("id, name, email, persona, latest_mood, latest_sentiment, response_count, is_hidden, last_responded_at, created_at, updated_at", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order(safeSort, { ascending: sortDir })
    .range((page - 1) * perPage, page * perPage - 1);

  if (campaignId) {
    const { data: campPersonIds } = await db
      .from("responses")
      .select("person_id")
      .eq("campaign_id", campaignId)
      .eq("tenant_id", tenantId);
    const ids = [...new Set((campPersonIds ?? []).map((r: { person_id: string }) => r.person_id))];
    if (ids.length > 0) {
      query = query.in("id", ids);
    } else {
      return NextResponse.json({ people: [], total: 0, page, totalPages: 0 });
    }
  }

  if (showHidden) {
    query = query.eq("is_hidden", true);
  } else {
    query = query.or("is_hidden.is.null,is_hidden.eq.false");
  }

  if (persona) query = query.eq("persona", persona);
  if (sentiment) query = query.eq("latest_sentiment", sentiment);
  if (mood) query = query.eq("latest_mood", mood);
  if (search) {
    const sanitized = search.replace(/[%_,.()\[\]]/g, "");
    if (sanitized) query = query.or(`name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load people" }, { status: 500 });

  return NextResponse.json({
    people: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / perPage),
  });
}
