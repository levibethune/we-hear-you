import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * Public RSS feed for a video feed.
 * GET /api/feeds/[slug]/rss
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const db = getServerClient();

  const { data: feed } = await db
    .from("video_feeds")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!feed) {
    return new NextResponse("Feed not found", { status: 404 });
  }

  // Pull responses
  let respQuery = db
    .from("responses")
    .select("id, person_id, transcription, themes, mood, sentiment, video_url, raw_analysis, created_at, person:people(id, name, persona)")
    .eq("tenant_id", feed.tenant_id)
    .not("video_url", "is", null)
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("created_at", { ascending: false })
    .limit(200);

  if (feed.campaign_id) {
    respQuery = respQuery.eq("campaign_id", feed.campaign_id);
  }

  const { data: responses } = await respQuery;

  const { matchesConditions } = await import("../../../../../lib/flows/conditions.js");
  const { passesSafety } = await import("../../../../../lib/feeds/safety.js");

  const items = (responses ?? [])
    .filter((r) => {
      const person = Array.isArray(r.person) ? r.person[0] : r.person;
      if (!matchesConditions(feed.conditions, feed.condition_logic, r, person || {})) return false;
      if (!passesSafety(r, feed.safety_required, feed.topic).passes) return false;
      return true;
    })
    .slice(0, 50);

  const baseUrl = "https://app.wehearyou.io";
  const feedUrl = `${baseUrl}/api/feeds/${slug}/rss`;
  const now = new Date().toUTCString();

  const rssItems = items.map((r) => {
    const person = Array.isArray(r.person) ? r.person[0] : r.person;
    const personName = person?.name || "Anonymous";
    const persona = (r.raw_analysis as Record<string, string>)?.persona || "";
    const embedUrl = `${baseUrl}/embed/response/${r.id}`;
    const transcript = (r.transcription || "").slice(0, 500);
    const pubDate = new Date(r.created_at).toUTCString();

    return `    <item>
      <title>${escapeXml(personName)}${persona ? ` — ${escapeXml(persona)}` : ""}</title>
      <description><![CDATA[${transcript}${r.transcription && r.transcription.length > 500 ? "..." : ""}]]></description>
      <link>${embedUrl}</link>
      <guid isPermaLink="false">${r.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${escapeXml(r.video_url || "")}" type="video/mp4" />
    </item>`;
  }).join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(feed.name)}</title>
    <description>${escapeXml(feed.description || "")}</description>
    <link>${baseUrl}/feeds/${slug}</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${now}</lastBuildDate>
    <language>en</language>
${rssItems}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
