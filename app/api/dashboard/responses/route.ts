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
  const sentiment = params.get("sentiment");
  const source = params.get("source");
  const search = params.get("search");
  const sort = params.get("sort");

  const db = getServerClient();

  const campaignId = params.get("campaign_id");
  const showHidden = params.get("show_hidden") === "true";

  let query = db
    .from("responses")
    .select("id, person_id, transcription, themes, mood, sentiment, video_url, source_type, source_form_name, share_url, raw_analysis, is_hidden, created_at, person:people(name, email)", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (campaignId) query = query.eq("campaign_id", campaignId);

  query = query
    .order("created_at", { ascending: sort === "oldest" })
    .range((page - 1) * perPage, page * perPage - 1);

  if (showHidden) {
    query = query.eq("is_hidden", true);
  } else {
    query = query.or("is_hidden.is.null,is_hidden.eq.false");
  }

  const moodParam = params.get("mood");
  const personaParam = params.get("persona");
  const form = params.get("form");

  if (sentiment) query = query.eq("sentiment", sentiment);
  if (moodParam) query = query.eq("mood", moodParam);
  if (source) query = query.eq("source_type", source);
  if (personaParam) query = query.contains("raw_analysis", { persona: personaParam });
  if (form) query = query.eq("source_form_name", form);

  // Custom analysis field filters (passed as custom_fieldname=value)
  for (const [key, value] of params.entries()) {
    if (key.startsWith("custom_") && value) {
      const fieldName = key.slice(7); // strip "custom_" prefix
      query = query.contains("raw_analysis", { [fieldName]: value });
    }
  }

  if (search) {
    query = query.textSearch("transcription_search", search, { type: "websearch" });
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load responses" }, { status: 500 });

  return NextResponse.json({
    responses: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / perPage),
  });
}
