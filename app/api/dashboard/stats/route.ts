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

  // Compute fieldStats from raw_analysis based on the active analysis config
  const fieldStats: Record<string, { type: string; counts?: Record<string, number>; items?: { value: string; count: number }[]; top?: string | number }> = {};
  const fieldDisplays: Record<string, string> = {};

  // Fetch the analysis config to know field shapes
  let configQuery = db.from("analysis_configs").select("output_schema").eq("is_active", true).limit(1);
  if (campaignId) {
    configQuery = configQuery.eq("campaign_id", campaignId);
  } else {
    configQuery = configQuery.eq("tenant_id", tenantId);
  }
  const { data: configData } = await configQuery.maybeSingle();

  if (configData?.output_schema?.properties) {
    const schema = configData.output_schema;
    // Fetch raw_analysis from recent responses for aggregation
    let rawQuery = db.from("responses").select("raw_analysis").eq("tenant_id", tenantId).or("is_hidden.is.null,is_hidden.eq.false").limit(500);
    if (campaignId) rawQuery = rawQuery.eq("campaign_id", campaignId);
    const { data: rawRows } = await rawQuery;
    const analyses = (rawRows ?? []).map((r: { raw_analysis: Record<string, unknown> }) => r.raw_analysis).filter(Boolean);

    for (const [fieldName, prop] of Object.entries(schema.properties) as [string, Record<string, unknown>][]) {
      // Skip the safety field (internal)
      if (fieldName === "safety") continue;

      const display = (prop.dashboard_display as string) || undefined;
      if (display) fieldDisplays[fieldName] = display;
      if ((prop as Record<string, unknown>).dashboard_show_top) fieldDisplays[fieldName + "__show_top"] = "true";
      if ((prop as Record<string, unknown>).dashboard_show_average) fieldDisplays[fieldName + "__show_average"] = "true";
      if (display === "hidden") continue;

      if (prop.enum || (prop.type === "string" && !prop.items)) {
        // Enum or plain string → count values
        const counts: Record<string, number> = {};
        for (const a of analyses) {
          const val = a[fieldName];
          if (val && typeof val === "string") {
            counts[val] = (counts[val] || 0) + 1;
          }
        }
        const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
        fieldStats[fieldName] = { type: "enum", counts, top: top?.[0] };
      } else if (prop.type === "array") {
        // Array → flatten and count
        const counts: Record<string, number> = {};
        for (const a of analyses) {
          const arr = a[fieldName];
          if (Array.isArray(arr)) {
            for (const v of arr) {
              if (typeof v === "string") counts[v] = (counts[v] || 0) + 1;
            }
          }
        }
        const items = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 15).map(([value, count]) => ({ value, count }));
        fieldStats[fieldName] = { type: "array", items, top: items[0]?.value };
      } else if (prop.type === "number") {
        // Number → average
        let sum = 0, count = 0;
        for (const a of analyses) {
          const val = a[fieldName];
          if (typeof val === "number") { sum += val; count++; }
        }
        fieldStats[fieldName] = { type: "scalar", top: count > 0 ? Math.round(sum / count * 10) / 10 : 0 };
      } else if (prop.type === "boolean") {
        // Boolean → count true/false
        const counts: Record<string, number> = { "true": 0, "false": 0 };
        for (const a of analyses) {
          const val = a[fieldName];
          if (typeof val === "boolean") counts[String(val)]++;
        }
        fieldStats[fieldName] = { type: "enum", counts, top: counts["true"] >= counts["false"] ? "Yes" : "No" };
      }
    }
  }

  return NextResponse.json({
    totalPeople,
    totalResponses: responsesCount.count ?? 0,
    sentimentBreakdown,
    topThemes,
    recentResponses: recentData.data ?? [],
    fieldStats,
    fieldDisplays,
  });
}
