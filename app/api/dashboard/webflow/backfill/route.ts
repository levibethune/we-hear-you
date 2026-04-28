import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";
import { matchesConditions, describeFirstFailure } from "../../../../../lib/flows/conditions.js";
import { executeWebflowAction } from "../../../../../lib/integrations/webflow-action.js";

/**
 * Send past responses to a Webflow output.
 * POST { tenant_id, flow_id, limit? } — processes in batches.
 * Returns { total, sent, skipped, failed, errors }.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, flow_id, limit } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!flow_id) {
    return NextResponse.json({ error: "flow_id is required" }, { status: 400 });
  }

  const db = getServerClient();

  // Fetch the flow
  const { data: flow } = await db
    .from("flows")
    .select("*")
    .eq("id", flow_id)
    .eq("tenant_id", tenant_id)
    .single();

  if (!flow) return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  if (flow.action_type !== "webflow") return NextResponse.json({ error: "Not a Webflow flow" }, { status: 400 });

  // Fetch responses. Scope by campaign if set.
  let respQuery = db
    .from("responses")
    .select("id, tenant_id, campaign_id, person_id, transcription, themes, mood, sentiment, video_url, source_type, source_form_name, raw_analysis, created_at")
    .eq("tenant_id", tenant_id)
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("created_at", { ascending: false });

  if (flow.campaign_id) {
    respQuery = respQuery.eq("campaign_id", flow.campaign_id);
  }

  // Cap at 100 per request to avoid Vercel timeout
  const cap = Math.min(parseInt(String(limit)) || 50, 100);
  respQuery = respQuery.limit(cap);

  const { data: responses } = await respQuery;
  if (!responses) return NextResponse.json({ error: "Failed to fetch responses" }, { status: 500 });

  // Fetch all people in one go
  const personIds = [...new Set(responses.map((r) => r.person_id).filter(Boolean))];
  const { data: peopleData } = await db
    .from("people")
    .select("id, email, name, persona, latest_mood, latest_sentiment")
    .in("id", personIds);
  const peopleById = Object.fromEntries((peopleData || []).map((p) => [p.id, p]));

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const resp of responses) {
    const person = peopleById[resp.person_id] || { id: resp.person_id, email: null, name: null, persona: null };

    // Check conditions
    if (!matchesConditions(flow.conditions, flow.condition_logic, resp, person)) {
      skipped++;
      const reason = describeFirstFailure(flow.conditions, flow.condition_logic, resp, person);
      await db.from("flow_executions").insert({
        flow_id: flow.id,
        tenant_id,
        trigger_event: "backfill",
        trigger_record_id: resp.id,
        status: "skipped",
        error: reason ? `Conditions: ${reason}` : "Conditions did not match",
      });
      continue;
    }

    // Check safety filters
    const safetyReq = flow.action_config?.safety_required;
    if (safetyReq) {
      const safety = resp.raw_analysis?.safety || {};
      let safetyReason = null;
      if (safetyReq.no_pii && safety.contains_pii) safetyReason = "Response contains personal information (PII)";
      else if (safetyReq.no_profanity && safety.contains_profanity) safetyReason = "Response contains profanity";
      else if (safetyReq.no_hate_speech && safety.contains_hate_speech) safetyReason = "Response contains hate speech or harassment";
      if (safetyReason) {
        skipped++;
        await db.from("flow_executions").insert({
          flow_id: flow.id,
          tenant_id,
          trigger_event: "backfill",
          trigger_record_id: resp.id,
          status: "skipped",
          error: `Safety filter: ${safetyReason}`,
        });
        continue;
      }
    }

    // Execute
    try {
      const result = await executeWebflowAction(flow, "backfill", resp, person);
      const isSuccess = result.status && result.status >= 200 && result.status < 300;
      if (isSuccess) {
        sent++;
      } else {
        failed++;
        if (result.error) errors.push(`${resp.id.slice(0, 8)}: ${result.error}`);
        else if (result.body) errors.push(`${resp.id.slice(0, 8)}: HTTP ${result.status}`);
      }

      // Log execution
      await db.from("flow_executions").insert({
        flow_id: flow.id,
        tenant_id,
        trigger_event: "backfill",
        trigger_record_id: resp.id,
        status: isSuccess ? "success" : "failed",
        response_status_code: result.status || null,
        response_body: result.body || result.error || null,
        error: result.error || null,
        payload_sent: result.payload || null,
      });
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${resp.id.slice(0, 8)}: ${msg}`);
    }
  }

  // Update last_triggered_at if any succeeded
  if (sent > 0) {
    await db.from("flows").update({ last_triggered_at: new Date().toISOString() }).eq("id", flow.id);
  }

  return NextResponse.json({
    total: responses.length,
    sent,
    skipped,
    failed,
    errors: errors.slice(0, 10),
  });
}
