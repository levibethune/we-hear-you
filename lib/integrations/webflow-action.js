/**
 * Webflow CMS action handler.
 * Creates a CMS item when a flow matches.
 */

import { getServiceClient } from "../supabase.js";
import { createItem } from "./webflow.js";
import { readOAuthToken, OAUTH_TOKEN_SELECT } from "../crypto/oauth-helpers.js";

/**
 * Resolve a WHY field key to its value.
 */
function resolveField(key, response, person, flow) {
  switch (key) {
    case "response_id":
      return response.id || null;
    case "person_id":
      return person?.id || response.person_id || null;
    case "person_name":
      return person?.name || null;
    case "person_email":
      return person?.email || null;
    case "persona":
      return response.raw_analysis?.persona || person?.persona || null;
    case "mood":
      return response.mood || null;
    case "sentiment":
      return response.sentiment || null;
    case "transcription":
      return response.transcription || null;
    case "themes":
      return Array.isArray(response.themes) ? response.themes.join(", ") : null;
    case "video_url":
      return response.video_url || null;
    case "video_embed_url": {
      if (!response.id) return null;
      const embedOpts = flow?.action_config?.embed_options;
      const params = [];
      if (embedOpts) {
        if (!embedOpts.showName) params.push("name=0");
        if (!embedOpts.showPersona) params.push("persona=0");
        if (!embedOpts.showMood) params.push("mood=0");
        if (!embedOpts.showSentiment) params.push("sentiment=0");
        if (!embedOpts.showProgress) params.push("progress=0");
        if (!embedOpts.showTime) params.push("time=0");
        if (embedOpts.accentColor && embedOpts.accentColor !== "#f4a07a") params.push(`accent=${encodeURIComponent(embedOpts.accentColor)}`);
        // Custom fields: hide those not in the visible list
        if (Array.isArray(embedOpts.customFieldsVisible)) {
          const rawKeys = Object.keys(response.raw_analysis || {}).filter((k) => !["themes","mood","sentiment","persona","safety"].includes(k));
          for (const k of rawKeys) {
            if (!embedOpts.customFieldsVisible.includes(k)) params.push(`cf_${k}=0`);
          }
        }
      }
      const qs = params.length ? `?${params.join("&")}` : "";
      return `https://app.wehearyou.io/embed/response/${response.id}${qs}`;
    }
    case "source_form_name":
      return response.source_form_name || null;
    case "created_at":
      return response.created_at || null;
    default:
      // Custom analysis fields — keys like "analysis_topic"
      if (key.startsWith("analysis_")) {
        const fieldName = key.slice(9);
        const val = response.raw_analysis?.[fieldName];
        if (Array.isArray(val)) return val.join(", ");
        return val ?? null;
      }
      return null;
  }
}

export async function executeWebflowAction(flow, event, response, person) {
  const config = flow.action_config || {};
  const { collection_id, field_mapping, auto_publish } = config;

  if (!collection_id) {
    return { error: "No Webflow collection configured" };
  }
  if (!field_mapping || Object.keys(field_mapping).length === 0) {
    return { error: "No field mapping configured" };
  }

  const supabase = getServiceClient();

  // Fetch the stored Webflow token (encrypted column preferred)
  const { data: conn } = await supabase
    .from("oauth_connections")
    .select(OAUTH_TOKEN_SELECT)
    .eq("tenant_id", flow.tenant_id)
    .eq("provider", "webflow")
    .maybeSingle();

  const accessToken = await readOAuthToken(conn, "access_token");
  if (!accessToken) {
    return { error: "Webflow not connected for this tenant" };
  }

  // Build fieldData from the mapping
  const fieldData = {};
  for (const [whyKey, webflowSlug] of Object.entries(field_mapping)) {
    if (!webflowSlug) continue;
    const value = resolveField(whyKey, response, person, flow);
    if (value != null && value !== "") {
      fieldData[webflowSlug] = value;
    }
  }

  // Webflow requires a "name" field; if none mapped, generate a sensible fallback
  if (!fieldData.name) {
    const personLabel = person?.name || person?.email || "Anonymous";
    const date = new Date(response.created_at || Date.now()).toLocaleDateString();
    fieldData.name = `${personLabel} — ${date}`;
  }

  try {
    const { status, body } = await createItem(accessToken, collection_id, fieldData, !!auto_publish);
    return {
      status,
      body: typeof body === "string" ? body.slice(0, 1024) : JSON.stringify(body).slice(0, 1024),
      payload: { collection_id, fieldData, published: !!auto_publish },
    };
  } catch (err) {
    return {
      error: err?.message || "Webflow request failed",
      payload: { collection_id, fieldData },
    };
  }
}
