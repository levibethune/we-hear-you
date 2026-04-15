import { getServiceClient } from "../lib/supabase.js";
import { analyzeTranscription } from "../lib/analyze.js";
import { normalize } from "../lib/adapters/videoask.js";
import { sanitizeTranscription } from "../lib/middleware/sanitize.js";
import { encrypt } from "../lib/crypto/pii.js";
import { authenticate } from "../lib/middleware/auth.js";

/**
 * Legacy webhook endpoint.
 * Now requires API key authentication (same as /api/ingest/[source]).
 * New integrations should use /api/ingest/[source] instead.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Require API key authentication
  const auth = await authenticate(req, res, "ingest");
  if (!auth) return; // Response already sent by authenticate()

  try {
    // Normalize through VideoAsk adapter
    const data = normalize(req.body);

    if (!data.email) {
      return res.status(400).json({ error: "Missing email in submission" });
    }

    const cleanTranscription = sanitizeTranscription(data.transcription);
    if (!cleanTranscription) {
      return res.status(400).json({ error: "Missing transcription" });
    }

    // Analyze with Claude (uses defaults — no tenant config)
    const analysis = await analyzeTranscription(cleanTranscription, data.name, null);

    // Encrypt PII
    const [emailEncrypted, nameEncrypted, transcriptionEncrypted] = await Promise.all([
      encrypt(data.email),
      encrypt(data.name),
      encrypt(cleanTranscription),
    ]);

    const supabase = getServiceClient();

    // Upsert person (tenant_id comes from API key auth)
    const { data: person, error: personError } = await supabase
      .from("people")
      .upsert(
        {
          tenant_id: auth.tenantId,
          email: data.email,
          email_encrypted: emailEncrypted,
          name: data.name || undefined,
          name_encrypted: nameEncrypted,
          latest_mood: analysis.mood,
          latest_sentiment: analysis.sentiment,
        },
        { onConflict: "tenant_id,email" }
      )
      .select("id")
      .single();

    if (personError) throw personError;

    // Insert response
    const { error: responseError } = await supabase.from("responses").upsert(
      {
        tenant_id: auth.tenantId,
        person_id: person.id,
        transcription: cleanTranscription,
        transcription_encrypted: transcriptionEncrypted,
        themes: analysis.themes,
        mood: analysis.mood,
        sentiment: analysis.sentiment,
        video_url: data.mediaUrl,
        videoask_response_id: data.sourceResponseId,
        source_type: "videoask",
        raw_analysis: analysis,
      },
      { onConflict: "videoask_response_id" }
    );

    if (responseError) throw responseError;

    // Update response count
    const { count } = await supabase
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("person_id", person.id);

    await supabase
      .from("people")
      .update({ response_count: count })
      .eq("id", person.id);

    return res.status(200).json({
      success: true,
      person_id: person.id,
      analysis,
    });
  } catch (error) {
    console.error("Webhook processing error:", error?.message || error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
