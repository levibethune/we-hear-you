/**
 * Flow evaluation orchestrator.
 * Called at the end of ingest and reanalysis to fire matching flows.
 */

import { getServiceClient } from "../supabase.js";
import { matchesConditions, describeFirstFailure } from "./conditions.js";
import { executeWebhookAction } from "./actions.js";
import { sendSlackNotification } from "../notifications/slack.js";
import { createInAppNotification } from "../notifications/in_app.js";
import { queueDigestItem } from "../notifications/digest.js";
import { executeWebflowAction } from "../integrations/webflow-action.js";

/**
 * Evaluate all active flows for a tenant against a response/person pair.
 * Fires matching webhook actions and logs executions.
 *
 * @param {string} tenantId
 * @param {string|null} campaignId - Campaign ID (null evaluates org-wide flows only)
 * @param {string} event - 'response_created' or 'person_updated'
 * @param {object} response - Full response record (with raw_analysis)
 * @param {object} person - Person record (with id, email, name, persona, etc.)
 */
export async function evaluateFlows(tenantId, campaignId, event, response, person) {
  const supabase = getServiceClient();

  try {
    let flowQuery = supabase
      .from("flows")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    // Match campaign-scoped flows for this campaign + org-wide flows (campaign_id is null)
    if (campaignId) {
      flowQuery = flowQuery.or(`campaign_id.eq.${campaignId},campaign_id.is.null`);
    } else {
      flowQuery = flowQuery.is("campaign_id", null);
    }

    const { data: flows } = await flowQuery;

    if (!flows || flows.length === 0) return;

    for (const flow of flows) {
      // Check if this flow listens to this event
      if (flow.trigger_on !== "both" && flow.trigger_on !== event) continue;

      // Evaluate conditions
      if (!matchesConditions(flow.conditions, flow.condition_logic, response, person)) {
        const reason = describeFirstFailure(flow.conditions, flow.condition_logic, response, person);
        await supabase.from("flow_executions").insert({
          flow_id: flow.id,
          tenant_id: tenantId,
          trigger_event: event,
          trigger_record_id: response.id || person.id,
          status: "skipped",
          error: reason ? `Conditions: ${reason}` : "Conditions did not match",
        });
        continue;
      }

      // Check safety filters (if configured in action_config)
      const safetyReq = flow.action_config?.safety_required;
      if (safetyReq) {
        const safety = response.raw_analysis?.safety || {};
        let safetyReason = null;
        if (safetyReq.no_pii && safety.contains_pii) safetyReason = "Response contains personal information (PII)";
        else if (safetyReq.no_profanity && safety.contains_profanity) safetyReason = "Response contains profanity";
        else if (safetyReq.no_hate_speech && safety.contains_hate_speech) safetyReason = "Response contains hate speech or harassment";
        if (safetyReason) {
          await supabase.from("flow_executions").insert({
            flow_id: flow.id,
            tenant_id: tenantId,
            trigger_event: event,
            trigger_record_id: response.id || person.id,
            status: "skipped",
            error: `Safety filter: ${safetyReason}`,
          });
          continue;
        }
      }

      // Execute action — dispatch by type
      let result;
      if (flow.action_type === "webhook") {
        result = await executeWebhookAction(flow, event, response, person);
      } else if (flow.action_type === "slack") {
        result = await sendSlackNotification(flow, response, person);
      } else if (flow.action_type === "in_app") {
        result = await createInAppNotification(flow, response, person);
      } else if (flow.action_type === "email_digest") {
        result = await queueDigestItem(flow, response, person);
      } else if (flow.action_type === "webflow") {
        result = await executeWebflowAction(flow, event, response, person);
      } else {
        continue;
      }

      const isSuccess = result.status && result.status >= 200 && result.status < 300;

      // Log execution
      await supabase.from("flow_executions").insert({
        flow_id: flow.id,
        tenant_id: tenantId,
        trigger_event: event,
        trigger_record_id: response.id || person.id,
        status: isSuccess ? "success" : "failed",
        response_status_code: result.status || null,
        response_body: result.body || result.error || null,
        error: result.error || null,
        payload_sent: result.payload || null,
      });

      // Update last_triggered_at on success
      if (isSuccess) {
        await supabase
          .from("flows")
          .update({ last_triggered_at: new Date().toISOString() })
          .eq("id", flow.id);
      }
    }
  } catch (err) {
    // Flow evaluation should never break the ingest pipeline
    console.error("Flow evaluation error:", err?.message || err);
  }
}
