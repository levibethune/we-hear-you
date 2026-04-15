import { notFound } from "next/navigation";
import { getServerClient } from "../../lib/supabase-server";

interface FeedVideo {
  id: string;
  video_url: string;
  transcription: string;
  themes: string[];
  mood: string | null;
  sentiment: string | null;
  persona: string | null;
  author: { name: string | null };
  created_at: string;
}

interface FeedData {
  feed: { name: string; description: string | null; topic: string | null };
  videos: FeedVideo[];
  count: number;
}

async function getFeed(slug: string): Promise<FeedData | null> {
  const db = getServerClient();

  const { data: feed } = await db
    .from("video_feeds")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!feed) return null;

  const { data: responses } = await db
    .from("responses")
    .select("id, person_id, transcription, themes, mood, sentiment, video_url, raw_analysis, created_at, person:people(id, name, persona)")
    .eq("tenant_id", feed.tenant_id)
    .not("video_url", "is", null)
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!responses) {
    return { feed: { name: feed.name, description: feed.description, topic: feed.topic }, videos: [], count: 0 };
  }

  const { matchesConditions } = await import("../../../lib/flows/conditions.js");
  const { passesSafety } = await import("../../../lib/feeds/safety.js");

  const matched = responses
    .filter((r) => {
      const person = Array.isArray(r.person) ? r.person[0] : r.person;
      if (!matchesConditions(feed.conditions, feed.condition_logic, r, person || {})) return false;
      if (!passesSafety(r, feed.safety_required, feed.topic).passes) return false;
      return true;
    })
    .slice(0, 24)
    .map((r) => {
      const person = Array.isArray(r.person) ? r.person[0] : r.person;
      return {
        id: r.id,
        video_url: r.video_url as string,
        transcription: r.transcription,
        themes: r.themes || [],
        mood: r.mood,
        sentiment: r.sentiment,
        persona: (r.raw_analysis as { persona?: string })?.persona ?? person?.persona ?? null,
        author: { name: person?.name ?? null },
        created_at: r.created_at,
      };
    });

  return {
    feed: { name: feed.name, description: feed.description, topic: feed.topic },
    videos: matched,
    count: matched.length,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getFeed(slug);
  return {
    title: data?.feed.name || "Video Feed",
    description: data?.feed.description || undefined,
  };
}

export default async function PublicFeedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getFeed(slug);

  if (!data) return notFound();

  return (
    <div
      style={{
        fontFamily: "-apple-system, system-ui, sans-serif",
        background: "#f5f1ea",
        color: "#1a1a1a",
        minHeight: "100vh",
        padding: "24px",
        margin: 0,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto 24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, marginTop: 0 }}>{data.feed.name}</h1>
        {data.feed.description && (
          <p style={{ fontSize: 14, color: "#666", marginTop: 0 }}>{data.feed.description}</p>
        )}
      </div>

      {data.videos.length === 0 ? (
        <p style={{ textAlign: "center", color: "#999", padding: "64px 24px" }}>
          No videos to show yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          {data.videos.map((v) => (
            <div
              key={v.id}
              style={{
                background: "#fff",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ position: "relative", paddingTop: "56.25%", background: "#000" }}>
                <video
                  src={v.video_url}
                  controls
                  preload="metadata"
                  playsInline
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
              <div style={{ padding: "14px 16px" }}>
                {v.author.name && (
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{v.author.name}</div>
                )}
                {v.persona && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "#f4a07a22",
                        color: "#c66c3c",
                      }}
                    >
                      {v.persona}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
