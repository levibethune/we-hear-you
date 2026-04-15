import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

async function getAnalyzer() {
  const { analyzeTranscription } = await import("../../../../../lib/analyze.js");
  return analyzeTranscription;
}

async function getEncryptor() {
  const { encrypt } = await import("../../../../../lib/crypto/pii.js");
  return encrypt;
}

async function getSanitizer() {
  const { sanitizeTranscription } = await import("../../../../../lib/middleware/sanitize.js");
  return sanitizeTranscription;
}

async function getFlowEvaluator() {
  const { evaluateFlows } = await import("../../../../../lib/flows/evaluate.js");
  return evaluateFlows;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, response_id, transcription } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!response_id || !transcription) {
    return NextResponse.json({ error: "response_id and transcription required" }, { status: 400 });
  }

  const db = getServerClient();

  // Verify the response belongs to this tenant
  const { data: existing } = await db
    .from("responses")
    .select("id, person_id")
    .eq("id", response_id)
    .eq("tenant_id", tenant_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Response not found" }, { status: 404 });
  }

  // Get analysis config
  const { data: config } = await db
    .from("analysis_configs")
    .select("system_prompt, output_schema, model")
    .eq("tenant_id", tenant_id)
    .eq("is_active", true)
    .limit(1)
    .single();

  const analyzeTranscription = await getAnalyzer();
  const encrypt = await getEncryptor();

  try {
    const sanitizeTranscription = await getSanitizer();
    const cleanText = sanitizeTranscription(transcription);
    if (!cleanText) {
      return NextResponse.json({ error: "Transcription is empty after cleaning" }, { status: 400 });
    }

    const analysis = await analyzeTranscription(cleanText, null, config) as Record<string, unknown>;
    const transcEnc = await encrypt(cleanText);

    // Update response
    await db
      .from("responses")
      .update({
        transcription: cleanText,
        transcription_encrypted: transcEnc,
        themes: (analysis.themes as string[]) ?? [],
        mood: analysis.mood as string,
        sentiment: analysis.sentiment as string,
        raw_analysis: analysis,
      })
      .eq("id", response_id);

    // Update person
    if (analysis.persona || analysis.mood || analysis.sentiment) {
      await db
        .from("people")
        .update({
          latest_mood: analysis.mood as string,
          latest_sentiment: analysis.sentiment as string,
          persona: (analysis.persona as string) || undefined,
        })
        .eq("id", existing.person_id);
    }

    // Fire matching flows after reprocess — use data already in scope to avoid extra queries
    try {
      // We need source_form_name which we don't have yet — one lightweight query
      const { data: meta } = await db
        .from("responses")
        .select("source_type, source_form_name, campaign_id, created_at")
        .eq("id", response_id)
        .single();

      const { data: personData } = await db
        .from("people")
        .select("id, email, name, persona, latest_mood, latest_sentiment")
        .eq("id", existing.person_id)
        .single();

      const evalFlows = await getFlowEvaluator();
      await evalFlows(tenant_id, meta?.campaign_id || null, "response_created", {
        id: response_id,
        transcription: cleanText,
        themes: (analysis.themes as string[]) ?? [],
        mood: analysis.mood as string,
        sentiment: analysis.sentiment as string,
        source_type: meta?.source_type || null,
        source_form_name: meta?.source_form_name || null,
        raw_analysis: analysis,
        created_at: meta?.created_at || new Date().toISOString(),
      }, personData || {
        id: existing.person_id,
        email: null,
        name: null,
        persona: (analysis.persona as string) || null,
        latest_mood: analysis.mood as string,
        latest_sentiment: analysis.sentiment as string,
      });
      return NextResponse.json({ success: true, analysis, flows_fired: true });
    } catch (err) {
      console.error("Flow eval after reprocess failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ success: true, analysis, flows_fired: false, flow_error: err instanceof Error ? err.message : String(err) });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Re-processing failed";
    console.error("Reprocess failed:", msg); return NextResponse.json({ error: "Re-processing failed. Please try again." }, { status: 500 });
  }
}
