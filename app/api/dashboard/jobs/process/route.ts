import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";
import { evaluateFlows as evalFlowsFn } from "../../../../../lib/flows/evaluate.js";

async function getAnalyzer() {
  const { analyzeTranscription } = await import("../../../../../lib/analyze.js");
  return analyzeTranscription;
}

async function getFlowEvaluator() {
  return evalFlowsFn;
}

async function getEncryptor() {
  const { encrypt } = await import("../../../../../lib/crypto/pii.js");
  return encrypt;
}

async function getSanitizer() {
  const { sanitizeTranscription } = await import("../../../../../lib/middleware/sanitize.js");
  return sanitizeTranscription;
}

const BATCH_SIZE = 3;

/**
 * POST — Process the next batch of items for a job.
 * Returns the updated progress. Client calls this repeatedly until done.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { job_id, tenant_id } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();

  // Get the job
  const { data: job } = await db
    .from("jobs")
    .select("*")
    .eq("id", job_id)
    .eq("tenant_id", tenant_id)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status === "completed" || job.status === "failed") {
    return NextResponse.json({ status: job.status, progress: job.progress, result: job.result });
  }

  // Mark as processing
  if (job.status === "pending") {
    await db.from("jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", job_id);
  }

  const params = job.params as Record<string, unknown>;
  const progress = (job.progress as { current: number; total: number; imported: number; skipped: number; failed: number }) ?? { current: 0, total: 0, imported: 0, skipped: 0, failed: 0 };

  try {
    if (job.type === "import_csv") {
      await processCSVBatch(db, job_id, tenant_id, params, progress);
    } else if (job.type === "import_links") {
      await processLinksBatch(db, job_id, tenant_id, params, progress);
    } else if (job.type === "reanalyze" || job.type === "bulk_reanalyze") {
      await processReanalyzeBatch(db, job_id, tenant_id, params, progress);
    }

    // Re-fetch updated progress
    const { data: updated } = await db.from("jobs").select("status, progress, result").eq("id", job_id).single();

    return NextResponse.json({
      status: updated?.status ?? "processing",
      progress: updated?.progress,
      result: updated?.result,
    });
  } catch {
    await db.from("jobs").update({
      status: "failed",
      error: "Processing error",
      updated_at: new Date().toISOString(),
    }).eq("id", job_id);

    return NextResponse.json({ status: "failed", error: "Processing error" });
  }
}

async function processCSVBatch(
  db: ReturnType<typeof getServerClient>,
  jobId: string,
  tenantId: string,
  params: Record<string, unknown>,
  progress: { current: number; total: number; imported: number; skipped: number; failed: number }
) {
  const rows = (params.rows as Array<{ email: string; name: string; transcription: string; share_url: string; date: string }>) ?? [];
  const formName = (params.form_name as string) ?? null;

  if (progress.total === 0) {
    progress.total = rows.length;
    await db.from("jobs").update({ progress, updated_at: new Date().toISOString() }).eq("id", jobId);
  }

  // Process the next batch
  const startIdx = progress.current;
  const batch = rows.slice(startIdx, startIdx + BATCH_SIZE);

  if (batch.length === 0) {
    await db.from("jobs").update({
      status: "completed",
      progress,
      result: { imported: progress.imported, skipped: progress.skipped, failed: progress.failed },
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    return;
  }

  const analyzeTranscription = await getAnalyzer();
  const encrypt = await getEncryptor();
  const sanitizeTranscription = await getSanitizer();

  const { data: analysisConfig } = await db
    .from("analysis_configs")
    .select("system_prompt, output_schema, model")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1)
    .single();

  await Promise.allSettled(
    batch.map(async (row) => {
      try {
        if (!row.email || !row.transcription) { progress.skipped++; return; }

        const cleanText = sanitizeTranscription(row.transcription);
        if (!cleanText) { progress.skipped++; return; }

        const contentHash = cleanText.slice(0, 100).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
        const sourceResponseId = `va-csv-${row.email}-${row.date}-${contentHash}`.replace(/[^a-zA-Z0-9\-_@.]/g, "");

        const { data: existing } = await db
          .from("responses").select("id").eq("videoask_response_id", sourceResponseId).eq("tenant_id", tenantId).limit(1);
        if (existing && existing.length > 0) { progress.skipped++; return; }

        const analysis = await analyzeTranscription(cleanText, row.name || null, analysisConfig) as Record<string, unknown>;

        const [emailEnc, nameEnc, transcEnc] = await Promise.all([
          encrypt(row.email), encrypt(row.name || null), encrypt(cleanText),
        ]);

        const respondedAt = row.date ? new Date(row.date).toISOString() : new Date().toISOString();

        const { data: person, error: pErr } = await db
          .from("people")
          .upsert({
            tenant_id: tenantId, email: row.email, email_encrypted: emailEnc,
            name: row.name || undefined, name_encrypted: nameEnc,
            latest_mood: analysis.mood as string, latest_sentiment: analysis.sentiment as string,
            persona: (analysis.persona as string) || undefined, last_responded_at: respondedAt,
          }, { onConflict: "tenant_id,email" })
          .select("id").single();

        if (pErr) { progress.failed++; return; }

        await db.from("responses").upsert({
          tenant_id: tenantId, person_id: person.id, transcription: cleanText,
          transcription_encrypted: transcEnc, themes: (analysis.themes as string[]) ?? [],
          mood: analysis.mood as string, sentiment: analysis.sentiment as string,
          videoask_response_id: sourceResponseId, source_type: "csv-import",
          source_form_name: formName, share_url: row.share_url || null, raw_analysis: analysis,
        }, { onConflict: "videoask_response_id" });

        progress.imported++;
      } catch {
        progress.failed++;
      }
    })
  );

  progress.current = startIdx + batch.length;

  const isComplete = progress.current >= rows.length;
  await db.from("jobs").update({
    status: isComplete ? "completed" : "processing",
    progress,
    ...(isComplete ? { result: { imported: progress.imported, skipped: progress.skipped, failed: progress.failed } } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
}

async function processLinksBatch(
  db: ReturnType<typeof getServerClient>,
  jobId: string,
  tenantId: string,
  params: Record<string, unknown>,
  progress: { current: number; total: number; imported: number; skipped: number; failed: number }
) {
  const urls = (params.urls as string[]) ?? [];

  if (progress.total === 0) {
    progress.total = urls.length;
    await db.from("jobs").update({ progress, updated_at: new Date().toISOString() }).eq("id", jobId);
  }

  const startIdx = progress.current;
  const batch = urls.slice(startIdx, startIdx + 1); // One at a time for link imports (each is heavy)

  if (batch.length === 0) {
    await db.from("jobs").update({
      status: "completed", progress,
      result: { imported: progress.imported, skipped: progress.skipped, failed: progress.failed },
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    return;
  }

  const analyzeTranscription = await getAnalyzer();
  const encrypt = await getEncryptor();
  const sanitizeTranscription = await getSanitizer();

  const { data: analysisConfig } = await db
    .from("analysis_configs")
    .select("system_prompt, output_schema, model")
    .eq("tenant_id", tenantId).eq("is_active", true).limit(1).single();

  for (const url of batch) {
    try {
      // Validate URL
      const parsed = new URL(url);
      if (parsed.hostname !== "www.videoask.com" && parsed.hostname !== "videoask.com") {
        progress.failed++; continue;
      }
      const pathMatch = parsed.pathname.match(/^\/([a-z0-9]+)$/i);
      if (!pathMatch) { progress.failed++; continue; }
      const shareId = pathMatch[1];

      // Fetch VideoAsk share page
      const pageRes = await fetch(`https://www.videoask.com/${shareId}`, { headers: { "User-Agent": "WeHearYou/1.0" } });
      if (!pageRes.ok) { progress.failed++; continue; }

      const html = await pageRes.text();
      const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!dataMatch) { progress.failed++; continue; }

      const nextData = JSON.parse(dataMatch[1]);
      const answer = nextData?.props?.pageProps?.answer;
      const contact = nextData?.props?.pageProps?.contact;
      const source = answer ?? contact;

      if (!source) { progress.failed++; continue; }

      const email = source.contact_email ?? source.email;
      const name = source.contact_name ?? source.name;

      // Get transcription from answer or contact's answers
      let transcription = "";
      if (answer?.transcription) {
        transcription = answer.transcription;
      } else if (contact?.answers) {
        transcription = contact.answers.map((a: { transcription?: string }) => a.transcription ?? "").filter(Boolean).join("\n\n");
      }

      if (!email || !transcription) { progress.skipped++; continue; }

      const cleanText = sanitizeTranscription(transcription);
      if (!cleanText) { progress.skipped++; continue; }

      const sourceResponseId = `va-link-${source.answer_id ?? source.contact_id ?? shareId}`;

      const { data: existing } = await db
        .from("responses").select("id").eq("videoask_response_id", sourceResponseId).eq("tenant_id", tenantId).limit(1);
      if (existing && existing.length > 0) { progress.skipped++; continue; }

      const analysis = await analyzeTranscription(cleanText, name, analysisConfig) as Record<string, unknown>;

      const [emailEnc, nameEnc, transcEnc] = await Promise.all([
        encrypt(email), encrypt(name), encrypt(cleanText),
      ]);

      const titleParts = (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").split(" | ");
      const formName = titleParts.length >= 2 ? titleParts[1]?.trim() : null;
      const respondedAt = source.created_at ?? new Date().toISOString();

      const { data: person, error: pErr } = await db
        .from("people")
        .upsert({
          tenant_id: tenantId, email, email_encrypted: emailEnc,
          name: name || undefined, name_encrypted: nameEnc,
          latest_mood: analysis.mood as string, latest_sentiment: analysis.sentiment as string,
          persona: (analysis.persona as string) || undefined, last_responded_at: respondedAt,
        }, { onConflict: "tenant_id,email" })
        .select("id").single();

      if (pErr) { progress.failed++; continue; }

      await db.from("responses").upsert({
        tenant_id: tenantId, person_id: person.id, transcription: cleanText,
        transcription_encrypted: transcEnc, themes: (analysis.themes as string[]) ?? [],
        mood: analysis.mood as string, sentiment: analysis.sentiment as string,
        videoask_response_id: sourceResponseId, source_type: "videoask-link",
        source_form_name: formName, share_url: source.share_url ?? url,
        raw_analysis: analysis,
      }, { onConflict: "videoask_response_id" });

      progress.imported++;
    } catch {
      progress.failed++;
    }
  }

  progress.current = startIdx + batch.length;
  const isComplete = progress.current >= urls.length;
  await db.from("jobs").update({
    status: isComplete ? "completed" : "processing", progress,
    ...(isComplete ? { result: { imported: progress.imported, skipped: progress.skipped, failed: progress.failed } } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
}

async function processReanalyzeBatch(
  db: ReturnType<typeof getServerClient>,
  jobId: string,
  tenantId: string,
  params: Record<string, unknown>,
  progress: { current: number; total: number; imported: number; skipped: number; failed: number }
) {
  const responseIds = (params.response_ids as string[]) ?? [];

  if (progress.total === 0) {
    progress.total = responseIds.length;
    await db.from("jobs").update({ progress, updated_at: new Date().toISOString() }).eq("id", jobId);
  }

  const startIdx = progress.current;
  const batch = responseIds.slice(startIdx, startIdx + BATCH_SIZE);

  if (batch.length === 0) {
    await db.from("jobs").update({
      status: "completed", progress,
      result: { processed: progress.imported, failed: progress.failed },
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    return;
  }

  const analyzeTranscription = await getAnalyzer();
  let evalFlows: Awaited<ReturnType<typeof getFlowEvaluator>> | null = null;
  try {
    evalFlows = await getFlowEvaluator();
  } catch (err) {
    console.error("Failed to load flow evaluator:", err);
  }

  await Promise.allSettled(
    batch.map(async (respId) => {
      try {
        const { data: resp } = await db
          .from("responses").select("id, transcription, person_id, source_type, source_form_name, campaign_id, video_url, created_at")
          .eq("id", respId).eq("tenant_id", tenantId).single();

        // Fetch the campaign-specific analysis config for this response
        let configQuery = db.from("analysis_configs").select("system_prompt, output_schema, model").eq("is_active", true).limit(1);
        if (resp?.campaign_id) {
          configQuery = configQuery.eq("campaign_id", resp.campaign_id);
        } else {
          configQuery = configQuery.eq("tenant_id", tenantId);
        }
        const { data: config } = await configQuery.maybeSingle();

        if (!resp?.transcription) { progress.skipped++; return; }

        const analysis = await analyzeTranscription(resp.transcription, null, config) as Record<string, unknown>;

        await db.from("responses").update({
          raw_analysis: analysis, themes: (analysis.themes as string[]) ?? [],
          mood: analysis.mood as string, sentiment: analysis.sentiment as string,
        }).eq("id", resp.id).eq("tenant_id", tenantId);

        if (analysis.persona || analysis.mood || analysis.sentiment) {
          await db.from("people").update({
            latest_mood: analysis.mood as string, latest_sentiment: analysis.sentiment as string,
            persona: (analysis.persona as string) || undefined,
          }).eq("id", resp.person_id).eq("tenant_id", tenantId);
        }

        // Fire matching flows after reanalysis
        if (evalFlows) try {
          const { data: personData } = await db.from("people")
            .select("id, email, name, persona, latest_mood, latest_sentiment")
            .eq("id", resp.person_id).eq("tenant_id", tenantId).single();

          await evalFlows(tenantId, resp.campaign_id || null, "response_created", {
            id: resp.id,
            campaign_id: resp.campaign_id || null,
            transcription: resp.transcription,
            themes: (analysis.themes as string[]) ?? [],
            mood: analysis.mood as string,
            sentiment: analysis.sentiment as string,
            source_type: resp.source_type || null,
            source_form_name: resp.source_form_name || null,
            video_url: resp.video_url || null,
            raw_analysis: analysis,
            created_at: resp.created_at || new Date().toISOString(),
          }, personData || {
            id: resp.person_id,
            email: null,
            name: null,
            persona: (analysis.persona as string) || null,
            latest_mood: analysis.mood as string,
            latest_sentiment: analysis.sentiment as string,
          });
        } catch (flowErr) { console.error("Flow eval failed for", resp.id, flowErr instanceof Error ? flowErr.message : flowErr); }

        progress.imported++;
      } catch {
        progress.failed++;
      }
    })
  );

  progress.current = startIdx + batch.length;
  const isComplete = progress.current >= responseIds.length;
  await db.from("jobs").update({
    status: isComplete ? "completed" : "processing", progress,
    ...(isComplete ? { result: { processed: progress.imported, failed: progress.failed } } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
}
