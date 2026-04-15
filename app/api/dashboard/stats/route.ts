import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const campaignId = request.nextUrl.searchParams.get("campaign_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();

  // Build response queries with optional campaign_id filter
  let responsesCountQuery = db.from("responses").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).or("is_hidden.is.null,is_hidden.eq.false");
  let sentimentQuery = db.from("responses").select("sentiment").eq("tenant_id", tenantId).or("is_hidden.is.null,is_hidden.eq.false").not("sentiment", "is", null).limit(5000);
  let recentQuery = db.from("responses").select("id, person_id, transcription, themes, mood, sentiment, video_url, source_type, source_form_name, share_url, raw_analysis, created_at, person:people(name, email)").eq("tenant_id", tenantId).or("is_hidden.is.null,is_hidden.eq.false").order("created_at", { ascending: false }).limit(3);

  if (campaignId) {
    responsesCountQuery = responsesCountQuery.eq("campaign_id", campaignId);
    sentimentQuery = sentimentQuery.eq("campaign_id", campaignId);
    recentQuery = recentQuery.eq("campaign_id", campaignId);
  }

  // For people count: if campaign_id, count distinct people from responses in that campaign
  let peopleCountPromise;
  if (campaignId) {
    peopleCountPromise = db.from("responses").select("person_id").eq("tenant_id", tenantId).eq("campaign_id", campaignId).or("is_hidden.is.null,is_hidden.eq.false");
  } else {
    peopleCountPromise = db.from("people").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).or("is_hidden.is.null,is_hidden.eq.false");
  }

  // Run all queries in parallel — using counts and limited selects instead of loading all rows
  const [peopleResult, responsesCount, sentimentCounts, recentData] =
    await Promise.all([
      peopleCountPromise,
      responsesCountQuery,
      sentimentQuery,
      recentQuery,
    ]);

  // Compute people count
  let totalPeople: number;
  if (campaignId) {
    const personIds = new Set((peopleResult.data as { person_id: string }[] ?? []).map((r) => r.person_id));
    totalPeople = personIds.size;
  } else {
    totalPeople = peopleResult.count ?? 0;
  }

  // Count sentiments (from limited set — good enough for dashboard)
  const sentimentBreakdown: Record<string, number> = {
    positive: 0, negative: 0, mixed: 0, neutral: 0,
  };
  for (const row of sentimentCounts.data ?? []) {
    if (row.sentiment && row.sentiment in sentimentBreakdown) {
      sentimentBreakdown[row.sentiment]++;
    }
  }

  // Count themes from recent responses only (top 200) for performance
  let themeQuery = db
    .from("responses")
    .select("themes")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (campaignId) themeQuery = themeQuery.eq("campaign_id", campaignId);

  const { data: themeRows } = await themeQuery;

  const themeCounts: Record<string, number> = {};
  for (const row of themeRows ?? []) {
    for (const theme of row.themes ?? []) {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([theme, count]) => ({ theme, count }));

  return NextResponse.json({
    totalPeople,
    totalResponses: responsesCount.count ?? 0,
    sentimentBreakdown,
    topThemes,
    recentResponses: recentData.data ?? [],
  });
}
