import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { flow_id, tenant_id, url, flow_name } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  // Either resolve from a saved flow, or accept a raw URL (for the create page)
  let config: { url?: string; method?: string; headers?: Record<string, string> } | null = null;
  let flowId = flow_id;
  let flowName = flow_name || "New Flow";

  if (flow_id) {
    const db = getServerClient();
    const { data: flow } = await db
      .from("flows")
      .select("*")
      .eq("id", flow_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!flow) return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    config = flow.action_config;
    flowName = flow.name;
  } else if (url) {
    config = { url };
  }

  if (!config?.url) return NextResponse.json({ error: "No webhook URL configured" }, { status: 400 });

  // Fetch analysis config to include sample custom fields in test payload
  const db2 = getServerClient();
  const { data: analysisConfig } = await db2
    .from("analysis_configs")
    .select("output_schema")
    .eq("tenant_id", tenant_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const customFields: Record<string, unknown> = {};
  if (analysisConfig?.output_schema?.properties) {
    for (const [key, prop] of Object.entries(analysisConfig.output_schema.properties) as [string, Record<string, unknown>][]) {
      if (["themes", "mood", "sentiment", "persona", "safety"].includes(key)) continue;
      if (prop.enum) customFields[`analysis_${key}`] = (prop.enum as string[])[0] || "sample";
      else if (prop.type === "array") customFields[`analysis_${key}`] = ["sample_1", "sample_2"];
      else if (prop.type === "number") customFields[`analysis_${key}`] = 7;
      else if (prop.type === "boolean") customFields[`analysis_${key}`] = true;
      else customFields[`analysis_${key}`] = "sample value";
    }
  }

  const testPayload = {
    event: "test",
    flow_id: flowId || null,
    flow_name: flowName,
    timestamp: new Date().toISOString(),
    test: true,
    person: {
      id: "00000000-0000-0000-0000-000000000000",
      email: "test@example.com",
      name: "Test Person",
      persona: "Sample Persona",
      latest_mood: "curious",
      latest_sentiment: "positive",
    },
    response: {
      id: "00000000-0000-0000-0000-000000000000",
      campaign_id: "00000000-0000-0000-0000-000000000000",
      transcription: "This is a test payload from We Hear You to verify your webhook connection is working.",
      themes: ["test", "webhook"],
      mood: "curious",
      sentiment: "positive",
      source_type: "test",
      source_form_name: "Test Form",
      video_url: "https://example.com/sample-video.mp4",
      created_at: new Date().toISOString(),
      ...customFields,
    },
  };

  try {
    const res = await fetch(config.url, {
      method: (config.method as string) || "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WHY-Flow-Id": flowId || "test",
        "X-WHY-Tenant-Id": tenant_id,
        ...(config.headers || {}),
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(5000),
    });

    const responseBody = await res.text().catch(() => "");

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      body: responseBody.slice(0, 1024),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ success: false, error: message }, { status: 200 });
  }
}
