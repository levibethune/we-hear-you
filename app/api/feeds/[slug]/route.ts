import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";

// Public, unauthenticated JSON feed.
// GET /api/feeds/[slug]?limit=12
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "12")));

  const db = getServerClient();

  // Find the feed by slug
  const { data: feed } = await db
    .from("video_feeds")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!feed) {
    return NextResponse.json({ error: "Feed not found" }, { status: 404 });
  }

  // Pull responses for this tenant that have video URLs
  let responsesQuery = db
    .from("responses")
    .select("id, person_id, transcription, themes, mood, sentiment, video_url, raw_analysis, created_at, person:people(id, name, persona)")
    .eq("tenant_id", feed.tenant_id)
    .not("video_url", "is", null)
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("created_at", { ascending: false })
    .limit(200);

  if (feed.campaign_id) {
    responsesQuery = responsesQuery.eq("campaign_id", feed.campaign_id);
  }

  const { data: responses } = await responsesQuery;

  if (!responses) {
    return NextResponse.json({ feed: { name: feed.name, description: feed.description }, videos: [] });
  }

  const { matchesConditions } = await import("../../../../lib/flows/conditions.js");
  const { passesSafety } = await import("../../../../lib/feeds/safety.js");

  const matched = responses
    .filter((r) => {
      const person = Array.isArray(r.person) ? r.person[0] : r.person;
      if (!matchesConditions(feed.conditions, feed.condition_logic, r, person || {})) return false;
      if (!passesSafety(r, feed.safety_required, feed.topic).passes) return false;
      return true;
    })
    .slice(0, limit)
    .map((r) => {
      const person = Array.isArray(r.person) ? r.person[0] : r.person;
      return {
        id: r.id,
        video_url: r.video_url,
        transcription: r.transcription,
        themes: r.themes,
        mood: r.mood,
        sentiment: r.sentiment,
        persona: r.raw_analysis?.persona ?? person?.persona ?? null,
        author: { name: person?.name ?? null },
        created_at: r.created_at,
      };
    });

  return NextResponse.json({
    feed: {
      name: feed.name,
      description: feed.description,
      topic: feed.topic,
    },
    videos: matched,
    count: matched.length,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
