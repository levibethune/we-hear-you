import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

const anthropic = new Anthropic();
const REFRESH_THRESHOLD = 3; // Regenerate after this many new responses

/**
 * GET — Return cached insight, or generate if stale.
 *   ?force=true — regenerate now (rate limited to once per day)
 */
export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const campaignId = request.nextUrl.searchParams.get("campaign_id");
  const forceRefresh = request.nextUrl.searchParams.get("force") === "true";

  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const db = getServerClient();

  // Get current response count
  let responseCountQuery = db
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .or("is_hidden.is.null,is_hidden.eq.false");
  if (campaignId) responseCountQuery = responseCountQuery.eq("campaign_id", campaignId);
  const { count: currentCount } = await responseCountQuery;

  const responseCount = currentCount ?? 0;

  if (responseCount === 0) {
    return NextResponse.json({ insight: null, cached: false });
  }

  // Check cache
  let cacheQuery = db
    .from("insight_cache")
    .select("*")
    .eq("tenant_id", tenantId);
  if (campaignId) cacheQuery = cacheQuery.eq("campaign_id", campaignId);
  const { data: cache } = await cacheQuery.maybeSingle();

  if (cache?.insight) {
    const countSinceGeneration = responseCount - (cache.response_count_at_generation ?? 0);
    const generatedAt = new Date(cache.generated_at);
    const hoursSinceGeneration = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);

    // Serve cached if:
    // - Not forcing refresh AND
    // - (fewer than REFRESH_THRESHOLD new responses OR generated less than 1 hour ago)
    if (!forceRefresh && (countSinceGeneration < REFRESH_THRESHOLD || hoursSinceGeneration < 1)) {
      return NextResponse.json({
        insight: cache.insight,
        cached: true,
        generatedAt: cache.generated_at,
        newResponsesSince: countSinceGeneration,
      });
    }

    // If forcing refresh, check once-per-day limit
    if (forceRefresh && hoursSinceGeneration < 24) {
      // Allow if there are enough new responses, otherwise block
      if (countSinceGeneration < REFRESH_THRESHOLD) {
        return NextResponse.json({
          insight: cache.insight,
          cached: true,
          generatedAt: cache.generated_at,
          newResponsesSince: countSinceGeneration,
          rateLimited: true,
        });
      }
    }
  }

  // Generate new insight
  let responsesQuery = db.from("responses").select("themes, mood, sentiment, transcription").eq("tenant_id", tenantId).or("is_hidden.is.null,is_hidden.eq.false").order("created_at", { ascending: false }).limit(30);
  if (campaignId) responsesQuery = responsesQuery.eq("campaign_id", campaignId);

  let peopleQuery;
  if (campaignId) {
    // Get people who have responses in this campaign
    const { data: campPersonIds } = await db.from("responses").select("person_id").eq("campaign_id", campaignId).eq("tenant_id", tenantId);
    const ids = [...new Set((campPersonIds ?? []).map((r: { person_id: string }) => r.person_id))];
    peopleQuery = ids.length > 0
      ? db.from("people").select("name, persona, latest_mood, latest_sentiment").in("id", ids).or("is_hidden.is.null,is_hidden.eq.false").limit(50)
      : Promise.resolve({ data: [] });
  } else {
    peopleQuery = db.from("people").select("name, persona, latest_mood, latest_sentiment").eq("tenant_id", tenantId).or("is_hidden.is.null,is_hidden.eq.false").limit(50);
  }

  const [peopleRes, responsesRes, taxonomyRes] = await Promise.all([
    peopleQuery,
    responsesQuery,
    db.from("taxonomies").select("buckets").eq("tenant_id", tenantId).eq("name", "Personas").maybeSingle(),
  ]);

  const people = peopleRes.data ?? [];
  const responses = responsesRes.data ?? [];
  const personas = (taxonomyRes.data?.buckets as Array<{ name: string; description: string }>) ?? [];

  const personaCounts: Record<string, number> = {};
  for (const p of people) {
    const key = p.persona ?? "Unclassified";
    personaCounts[key] = (personaCounts[key] || 0) + 1;
  }

  const sentimentCounts: Record<string, number> = {};
  const moodCounts: Record<string, number> = {};
  const allThemes: string[] = [];
  for (const r of responses) {
    if (r.sentiment) sentimentCounts[r.sentiment] = (sentimentCounts[r.sentiment] || 0) + 1;
    if (r.mood) moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1;
    for (const t of r.themes ?? []) allThemes.push(t);
  }

  const themeCounts: Record<string, number> = {};
  for (const t of allThemes) themeCounts[t] = (themeCounts[t] || 0) + 1;
  const topThemes = Object.entries(themeCounts).sort(([, a], [, b]) => b - a).slice(0, 10);

  const transcriptSnippets = responses.slice(0, 8).map((r) => (r.transcription ?? "").slice(0, 150));

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      temperature: 0.3,
      system: `You are an audience analyst. Write a brief, insightful 2-3 sentence summary of an audience based on the data provided. Be specific and actionable. Mention the most notable pattern, the dominant sentiment, and one suggestion. Do NOT use markdown formatting. Write in a warm, professional tone.`,
      messages: [{
        role: "user",
        content: `Audience data:
- ${people.length} people, ${responses.length} recent responses
- Personas: ${Object.entries(personaCounts).map(([k, v]) => `${k} (${v})`).join(", ")}
- Sentiment: ${Object.entries(sentimentCounts).map(([k, v]) => `${k} (${v})`).join(", ")}
- Top moods: ${Object.entries(moodCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([k, v]) => `${k} (${v})`).join(", ")}
- Top themes: ${topThemes.map(([k, v]) => `${k} (${v})`).join(", ")}
- Sample quotes: ${transcriptSnippets.map((s) => `"${s}..."`).join(" | ")}

Write a brief audience insight summary.`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const insightText = text.trim();

    // Cache the result
    await db.from("insight_cache").upsert({
      tenant_id: tenantId,
      ...(campaignId ? { campaign_id: campaignId } : {}),
      insight: insightText,
      response_count_at_generation: responseCount,
      generated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" });

    return NextResponse.json({
      insight: insightText,
      cached: false,
      generatedAt: new Date().toISOString(),
      newResponsesSince: 0,
    });
  } catch {
    // Return cache if generation fails
    if (cache?.insight) {
      return NextResponse.json({ insight: cache.insight, cached: true, generatedAt: cache.generated_at });
    }
    return NextResponse.json({ insight: null });
  }
}
