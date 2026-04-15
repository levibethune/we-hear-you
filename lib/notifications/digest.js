/**
 * Email digest queue + sender.
 * Matched responses are queued, then a weekly cron sends a digest.
 */

import { getServiceClient } from "../supabase.js";

/**
 * Add a matched response to the digest queue.
 * Called when an email_digest flow matches.
 */
export async function queueDigestItem(flow, response, person) {
  const supabase = getServiceClient();

  try {
    const { error } = await supabase.from("digest_queue").insert({
      tenant_id: flow.tenant_id,
      flow_id: flow.id,
      response_id: response.id || null,
      person_id: person.id || null,
    });

    if (error) return { error: error.message };
    return { status: 200, body: "queued" };
  } catch (err) {
    return { error: err?.message || "Failed to queue digest item" };
  }
}

/**
 * Process pending digest items for all email_digest flows.
 * Sends one email per flow to its configured recipients.
 * Called by the weekly cron.
 */
export async function processDigests() {
  const supabase = getServiceClient();
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Get all active email_digest flows
  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("action_type", "email_digest")
    .eq("is_active", true);

  if (!flows || flows.length === 0) {
    return { processed: 0, sent: 0 };
  }

  let totalSent = 0;

  for (const flow of flows) {
    const recipients = flow.action_config?.recipients || [];
    if (recipients.length === 0) continue;

    // Pull pending items for this flow
    const { data: items } = await supabase
      .from("digest_queue")
      .select(`
        id, matched_at, response_id, person_id,
        response:responses(id, transcription, themes, mood, sentiment, raw_analysis, created_at),
        person:people(id, email, name, persona)
      `)
      .eq("flow_id", flow.id)
      .is("sent_at", null)
      .order("matched_at", { ascending: true })
      .limit(100);

    if (!items || items.length === 0) continue;

    // Build digest HTML
    const html = buildDigestHtml(flow, items);
    const subject = `${flow.name} — ${items.length} new ${items.length === 1 ? "match" : "matches"} this week`;

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM || "We Hear You <onboarding@resend.dev>",
        to: recipients,
        subject,
        html,
      });

      // Mark all items as sent
      const now = new Date().toISOString();
      const ids = items.map((i) => i.id);
      await supabase.from("digest_queue").update({ sent_at: now }).in("id", ids);

      totalSent++;
    } catch (err) {
      console.error(`Digest send failed for flow ${flow.id}:`, err?.message || err);
    }
  }

  return { processed: flows.length, sent: totalSent };
}

function buildDigestHtml(flow, items) {
  const itemsHtml = items
    .map((item) => {
      const r = item.response || {};
      const p = item.person || {};
      const personLabel = p.name || p.email || "Someone";
      const persona = r.raw_analysis?.persona || p.persona || "";
      const transcript = (r.transcription || "").slice(0, 300);

      return `
        <div style="border-left: 3px solid #f4a07a; padding: 12px 16px; margin-bottom: 16px; background: #fafafa;">
          <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">${escapeHtml(personLabel)}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
            ${persona ? `<span style="background: #f4a07a22; color: #f4a07a; padding: 2px 8px; border-radius: 12px; margin-right: 6px;">${escapeHtml(persona)}</span>` : ""}
            <span style="color: #888;">${escapeHtml(r.sentiment || "")}</span>
            ${r.mood ? `<span style="color: #888;"> • ${escapeHtml(r.mood)}</span>` : ""}
          </div>
          <div style="font-size: 13px; color: #444; line-height: 1.5;">${escapeHtml(transcript)}${r.transcription?.length > 300 ? "…" : ""}</div>
        </div>
      `;
    })
    .join("\n");

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h1 style="font-size: 20px; margin-bottom: 4px;">${escapeHtml(flow.name)}</h1>
      <p style="color: #666; font-size: 14px; margin-top: 0; margin-bottom: 24px;">
        ${items.length} ${items.length === 1 ? "match" : "matches"} this week from We Hear You.
      </p>
      ${itemsHtml}
      <p style="font-size: 12px; color: #999; margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee;">
        You're receiving this because you're subscribed to digest notifications for "${escapeHtml(flow.name)}". Manage in your We Hear You dashboard.
      </p>
    </body>
    </html>
  `;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
