import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

// Must be >= the PostgREST `max_rows` in supabase/config.toml (currently 1000);
// the chunk loop relies on a short page meaning "last page".
const ID_PAGE_SIZE = 1000;

function buildResponsesQuery(
  db: ReturnType<typeof getServerClient>,
  tenantId: string | null,
  params: URLSearchParams,
  idsOnly: boolean
) {
  let query = db
    .from("responses")
    .select(
      idsOnly
        ? "id"
        : "id, person_id, campaign_id, transcription, themes, mood, sentiment, video_url, source_type, source_form_name, share_url, raw_analysis, is_hidden, created_at, person:people(name, email)",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId);

  const campaignId = params.get("campaign_id");
  if (campaignId) query = query.eq("campaign_id", campaignId);

  if (params.get("show_hidden") === "true") {
    query = query.eq("is_hidden", true);
  } else {
    query = query.or("is_hidden.is.null,is_hidden.eq.false");
  }

  const sentiment = params.get("sentiment");
  const moodParam = params.get("mood");
  const source = params.get("source");
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

  const search = params.get("search");
  if (search) {
    query = query.textSearch("transcription_search", search, { type: "websearch" });
  }

  return query.order("created_at", { ascending: params.get("sort") === "oldest" });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tenantId = params.get("tenant_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();
  const idsOnly = params.get("ids_only") === "true";

  // ids_only: page through in chunks so the PostgREST max_rows cap (1000)
  // can't silently truncate the full matching set — this powers "select all".
  if (idsOnly) {
    const ids: string[] = [];
    let total = 0;
    let offset = 0;
    for (;;) {
      const { data, count, error } = await buildResponsesQuery(db, tenantId, params, true)
        .range(offset, offset + ID_PAGE_SIZE - 1);
      if (error) return NextResponse.json({ error: "Failed to load responses" }, { status: 500 });
      total = count ?? total;
      const rows = (data ?? []) as unknown as { id: string }[];
      for (const r of rows) ids.push(r.id);
      if (rows.length < ID_PAGE_SIZE) break;
      offset += ID_PAGE_SIZE;
    }
    return NextResponse.json({ ids, total });
  }

  const page = Math.max(1, parseInt(params.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(params.get("per_page") ?? "25")));
  const { data, count, error } = await buildResponsesQuery(db, tenantId, params, false)
    .range((page - 1) * perPage, page * perPage - 1);
  if (error) return NextResponse.json({ error: "Failed to load responses" }, { status: 500 });

  return NextResponse.json({
    responses: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / perPage),
  });
}
