import { getServiceClient } from "../../lib/supabase.js";
import { analyzeTranscription } from "../../lib/analyze.js";
import { getAdapter } from "../../lib/adapters/index.js";
import { authenticate } from "../../lib/middleware/auth.js";
import { verifyWebhookSignature } from "../../lib/middleware/webhook-verify.js";
import { checkRateLimit } from "../../lib/middleware/rate-limit.js";
import { sanitizeTranscription } from "../../lib/middleware/sanitize.js";
import { encrypt } from "../../lib/crypto/pii.js";
import { evaluateFlows } from "../../lib/flows/evaluate.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Authenticate — resolve tenant from API key
  const auth = await authenticate(req, res, "ingest");
  if (!auth) return; // Response already sent

  const { tenantId } = auth;

  // 2. Rate limit
  const allowed = await checkRateLimit(req, res, tenantId);
  if (!allowed) return;

  // 3. Get tenant config (webhook secret for signature verification)
  const supabase = getServiceClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("webhook_secret")
    .eq("id", tenantId)
    .single();

  // 4. Verify webhook signature (if tenant has a secret configured)
  const sigValid = verifyWebhookSignature(req, res, tenant?.webhook_secret);
  if (!sigValid) return;

  // 5. Resolve adapter from dynamic route
  const sourceType = req.query.source;
  let adapter;
  try {
    adapter = getAdapter(sourceType);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // 6. Normalize payload through adapter
  const data = adapter.normalize(req.body);

  if (!data.email) {
    return res.status(400).json({ error: "Missing email in submission" });
  }

  // 7. Sanitize transcription
  const cleanTranscription = sanitizeTranscription(data.transcription);
  if (!cleanTranscription) {
    return res.status(400).json({ error: "Missing or empty transcription" });
  }

  try {
    // 8. Resolve campaign
    let campaignId = req.body.campaign_id || req.query.campaign_id;

    if (!campaignId && data.sourceFormName) {
      const { data: matchedCampaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("tenant_id", tenantId)
        .contains("form_names", [data.sourceFormName])
        .eq("is_archived", false)
        .limit(1)
        .maybeSingle();
      if (matchedCampaign) campaignId = matchedCampaign.id;
    }

    if (!campaignId) {
      const { data: defaultCampaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_default", true)
        .single();
      campaignId = defaultCampaign?.id;
    }

    // 9. Get campaign's analysis config
    const { data: analysisConfig } = await supabase
      .from("analysis_configs")
      .select("system_prompt, output_schema, model")
      .eq("campaign_id", campaignId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // 9. Analyze with Claude (uses tenant config or defaults)
    const analysis = await analyzeTranscription(cleanTranscription, data.name, analysisConfig);

    // 10. Encrypt PII before storage
    const [emailEncrypted, nameEncrypted, transcriptionEncrypted] = await Promise.all([
      encrypt(data.email),
      encrypt(data.name),
      encrypt(cleanTranscription),
    ]);

    // 11. Upsert person
    const { data: person, error: personError } = await supabase
      .from("people")
      .upsert(
        {
          tenant_id: tenantId,
          email: data.email,
          email_encrypted: emailEncrypted,
          name: data.name || undefined,
          name_encrypted: nameEncrypted,
          latest_mood: analysis.mood,
          latest_sentiment: analysis.sentiment,
          last_responded_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,email" }
      )
      .select("id")
      .single();

    if (personError) throw personError;

    // 12. Insert response
    const { error: responseError } = await supabase.from("responses").upsert(
      {
        tenant_id: tenantId,
        campaign_id: campaignId,
        person_id: person.id,
        transcription: cleanTranscription,
        transcription_encrypted: transcriptionEncrypted,
        themes: analysis.themes || [],
        mood: analysis.mood,
        sentiment: analysis.sentiment,
        video_url: data.mediaUrl,
        videoask_response_id: data.sourceResponseId,
        source_type: sourceType,
        raw_analysis: analysis,
      },
      { onConflict: "videoask_response_id" }
    );

    if (responseError) throw responseError;

    // 13. Update response count
    const { count } = await supabase
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("person_id", person.id);

    await supabase
      .from("people")
      .update({ response_count: count })
      .eq("id", person.id);

    // 14. Evaluate flows (fire matching webhooks)
    await evaluateFlows(tenantId, campaignId, "response_created", {
      id: person.id,
      campaign_id: campaignId,
      transcription: cleanTranscription,
      themes: analysis.themes || [],
      mood: analysis.mood,
      sentiment: analysis.sentiment,
      source_type: sourceType,
      source_form_name: data.sourceFormName || null,
      video_url: data.mediaUrl || null,
      raw_analysis: analysis,
      created_at: new Date().toISOString(),
    }, {
      id: person.id,
      email: data.email,
      name: data.name,
      persona: analysis.persona || null,
      latest_mood: analysis.mood,
      latest_sentiment: analysis.sentiment,
    });

    return res.status(200).json({
      success: true,
      person_id: person.id,
      analysis,
    });
  } catch (error) {
    console.error("Ingest error:", error?.message || error);
    return res.status(500).json({ error: "Processing failed" });
  }
}
