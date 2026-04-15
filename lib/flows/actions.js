/**
 * Flow action execution.
 * Sends webhook payloads to external services (Zapier, Make, etc.).
 */

import crypto from "crypto";

const BLOCKED_HOSTNAMES = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal"];

function isBlockedUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (BLOCKED_HOSTNAMES.includes(hostname)) return true;

    // Block private IPs
    if (/^10\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (/^169\.254\./.test(hostname)) return true; // AWS metadata

    // Block non-HTTPS (except for local dev)
    if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") return true;

    return false;
  } catch {
    return true;
  }
}

/**
 * Execute a webhook action for a matched flow.
 * @param {object} flow - The flow record
 * @param {string} event - Trigger event name
 * @param {object} response - Response data
 * @param {object} person - Person data
 * @returns {{ status: number, body: string } | { error: string }}
 */
export async function executeWebhookAction(flow, event, response, person) {
  const config = flow.action_config || {};
  const payload = buildPayload(flow, event, response, person, config.include_fields);

  const headers = {
    "Content-Type": "application/json",
    "X-WHY-Flow-Id": flow.id,
    "X-WHY-Tenant-Id": flow.tenant_id,
    ...(config.headers || {}),
  };

  if (config.secret) {
    const sig = crypto
      .createHmac("sha256", config.secret)
      .update(JSON.stringify(payload))
      .digest("hex");
    headers["X-WHY-Signature"] = sig;
  }

  if (isBlockedUrl(config.url)) {
    return { error: "Blocked URL: private/internal addresses not allowed", payload };
  }

  try {
    const res = await fetch(config.url, {
      method: config.method || "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    const body = await res.text().catch(() => "");

    return {
      status: res.status,
      body: body.slice(0, 1024),
      payload,
    };
  } catch (err) {
    return {
      error: err?.message || "Webhook request failed",
      payload,
    };
  }
}

function buildPayload(flow, event, response, person, includeFields) {
  const full = {
    event,
    flow_id: flow.id,
    flow_name: flow.name,
    timestamp: new Date().toISOString(),
    person: {
      id: person.id,
      email: person.email,
      name: person.name,
      persona: person.persona || response.raw_analysis?.persona || null,
      latest_mood: person.latest_mood || response.mood,
      latest_sentiment: person.latest_sentiment || response.sentiment,
    },
    response: {
      id: response.id,
      transcription: response.transcription,
      themes: response.themes || [],
      mood: response.mood,
      sentiment: response.sentiment,
      source_type: response.source_type,
      source_form_name: response.source_form_name,
      created_at: response.created_at,
    },
  };

  if (!includeFields || includeFields.length === 0) return full;

  // Filter to only requested fields
  const filtered = { event: full.event, flow_id: full.flow_id, flow_name: full.flow_name, timestamp: full.timestamp };
  if (includeFields.includes("person")) filtered.person = full.person;
  if (includeFields.includes("response")) filtered.response = full.response;
  return filtered;
}
