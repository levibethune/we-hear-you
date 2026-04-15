import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

async function getAnalyzer() {
  const { analyzeTranscription } = await import("../../../../lib/analyze.js");
  return analyzeTranscription;
}

async function getEncryptor() {
  const { encrypt } = await import("../../../../lib/crypto/pii.js");
  return encrypt;
}

async function getSanitizer() {
  const { sanitizeTranscription } = await import("../../../../lib/middleware/sanitize.js");
  return sanitizeTranscription;
}

async function getVideoUrlFetcher() {
  const { fetchVideoUrl } = await import("../../../../lib/adapters/videoask.js");
  return fetchVideoUrl;
}

/**
 * Import a SINGLE row from a parsed CSV.
 * The client parses the CSV and sends rows one at a time.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, campaign_id, email, name, transcription, share_url, date, form_name } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!email || !transcription) {
    return NextResponse.json({ status: "skipped", reason: "missing_data" });
  }

  const db = getServerClient();

  // Include a hash of transcription content to avoid collisions for same email+date
  const contentHash = transcription.slice(0, 100).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const sourceResponseId = `va-csv-${email}-${date}-${contentHash}`.replace(/[^a-zA-Z0-9\-_@.]/g, "");

  // Check duplicate per tenant
  const { data: existing } = await db
    .from("responses")
    .select("id")
    .eq("videoask_response_id", sourceResponseId)
    .eq("tenant_id", tenant_id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ status: "skipped", reason: "duplicate" });
  }

  try {
    const { data: analysisConfig } = await db
      .from("analysis_configs")
      .select("system_prompt, output_schema, model")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .limit(1)
      .single();

    const analyzeTranscription = await getAnalyzer();
    const encrypt = await getEncryptor();
    const sanitizeTranscription = await getSanitizer();

    const cleanTranscription = sanitizeTranscription(transcription);
    if (!cleanTranscription) {
      return NextResponse.json({ status: "skipped", reason: "empty_after_sanitize" });
    }

    const analysis = await analyzeTranscription(cleanTranscription, name || null, analysisConfig) as Record<string, unknown>;

    // Fetch video URL from share_url if available
    let videoUrl: string | null = null;
    if (share_url) {
      const fetchVideoUrl = await getVideoUrlFetcher();
      videoUrl = await fetchVideoUrl(share_url);
    }

    const [emailEnc, nameEnc, transcEnc] = await Promise.all([
      encrypt(email),
      encrypt(name || null),
      encrypt(transcription),
    ]);

    const respondedAt = date ? new Date(date).toISOString() : new Date().toISOString();

    const { data: person, error: pErr } = await db
      .from("people")
      .upsert({
        tenant_id,
        email,
        email_encrypted: emailEnc,
        name: name || undefined,
        name_encrypted: nameEnc,
        latest_mood: analysis.mood as string,
        latest_sentiment: analysis.sentiment as string,
        persona: (analysis.persona as string) || undefined,
        last_responded_at: respondedAt,
      }, { onConflict: "tenant_id,email" })
      .select("id")
      .single();

    if (pErr) {
      return NextResponse.json({ status: "failed" });
    }

    await db.from("responses").upsert({
      tenant_id,
      ...(campaign_id ? { campaign_id } : {}),
      person_id: person.id,
      transcription,
      transcription_encrypted: transcEnc,
      themes: (analysis.themes as string[]) ?? [],
      mood: analysis.mood as string,
      sentiment: analysis.sentiment as string,
      videoask_response_id: sourceResponseId,
      video_url: videoUrl,
      source_type: "csv-import",
      source_form_name: form_name || null,
      share_url: share_url || null,
      raw_analysis: analysis,
    }, { onConflict: "videoask_response_id" });

    const { count } = await db
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("person_id", person.id);

    await db.from("people").update({ response_count: count }).eq("id", person.id);

    return NextResponse.json({
      status: "imported",
      name: name || email,
      sentiment: analysis.sentiment,
      mood: analysis.mood,
    });
  } catch {
    return NextResponse.json({ status: "failed" });
  }
}
