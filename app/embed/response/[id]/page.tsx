import { notFound } from "next/navigation";
import { getServerClient } from "../../../lib/supabase-server";
import { EmbedPlayer } from "./EmbedPlayer";
import { checkEmbedRateLimit } from "../../../lib/embed-rate-limit";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getServerClient();
  const { data } = await db
    .from("responses")
    .select("mood, sentiment, person:people(name)")
    .eq("id", id)
    .single();

  const person = Array.isArray(data?.person) ? data.person[0] : data?.person;
  const title = person?.name ? `${person.name}'s Response` : "Video Response";

  return { title };
}

export default async function EmbedResponsePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const allowed = await checkEmbedRateLimit();
  if (!allowed) return notFound();

  const db = getServerClient();

  const { data: response } = await db
    .from("responses")
    .select("id, video_url, mood, sentiment, raw_analysis, person:people(name)")
    .eq("id", id)
    .single();

  if (!response || !response.video_url) return notFound();

  const person = Array.isArray(response.person) ? response.person[0] : response.person;
  const rawAnalysis = (response.raw_analysis || {}) as Record<string, unknown>;
  const persona = rawAnalysis.persona as string | undefined;

  // Extract custom fields (everything except built-ins)
  const customFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawAnalysis)) {
    if (["themes", "mood", "sentiment", "persona", "safety"].includes(k)) continue;
    if (v == null) continue;
    customFields[k] = Array.isArray(v) ? v.join(", ") : String(v);
  }

  // Embed display options from URL params (all default true if not specified)
  const options = {
    showName: query.name !== "0",
    showPersona: query.persona !== "0",
    showMood: query.mood !== "0",
    showSentiment: query.sentiment !== "0",
    showProgress: query.progress !== "0",
    showTime: query.time !== "0",
    accentColor: query.accent || "#f4a07a",
    // Custom fields: check `cf_fieldname=0` to hide
    visibleCustomFields: Object.keys(customFields).filter((k) => query[`cf_${k}`] !== "0"),
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #000; overflow: hidden; font-family: -apple-system, system-ui, sans-serif; }
        `}</style>
      </head>
      <body>
        <EmbedPlayer
          videoUrl={response.video_url}
          personName={person?.name ?? null}
          persona={persona ?? null}
          mood={response.mood}
          sentiment={response.sentiment}
          customFields={customFields}
          options={options}
        />
      </body>
    </html>
  );
}
