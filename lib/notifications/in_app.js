/**
 * In-app notification creator.
 * Inserts a notification into the in_app_notifications table.
 * Visible to all org members in the dashboard bell.
 */

import { getServiceClient } from "../supabase.js";

export async function createInAppNotification(flow, response, person) {
  const supabase = getServiceClient();

  const personLabel = person.name || person.email || "Someone";
  const sentiment = response.sentiment || "—";
  const persona = response.raw_analysis?.persona || person.persona;

  const title = `${flow.name}`;
  const body = `${personLabel} • ${sentiment}${persona ? ` • ${persona}` : ""}`;
  const link = `/dashboard/people/${person.id}`;

  try {
    const { error } = await supabase.from("in_app_notifications").insert({
      tenant_id: flow.tenant_id,
      flow_id: flow.id,
      trigger_record_id: response.id || person.id,
      title,
      body,
      link,
    });

    if (error) return { error: error.message };
    return { status: 200, body: "ok" };
  } catch (err) {
    return { error: err?.message || "Failed to create in-app notification" };
  }
}
