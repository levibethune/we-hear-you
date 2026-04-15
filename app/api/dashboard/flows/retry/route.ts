import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

const MAX_RETRIES = 3;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();

  // Find failed executions eligible for retry
  const { data: failed } = await db
    .from("flow_executions")
    .select("id, flow_id, payload_sent, retry_count")
    .eq("tenant_id", tenant_id)
    .eq("status", "failed")
    .lt("retry_count", MAX_RETRIES)
    .order("created_at", { ascending: true })
    .limit(10);

  if (!failed || failed.length === 0) {
    return NextResponse.json({ retried: 0 });
  }

  let succeeded = 0;
  let stillFailed = 0;

  for (const exec of failed) {
    // Get the flow's current config
    const { data: flow } = await db
      .from("flows")
      .select("action_config, is_active")
      .eq("id", exec.flow_id)
      .single();

    if (!flow?.is_active || !flow.action_config?.url) {
      // Flow disabled or no URL — mark permanently failed
      await db.from("flow_executions").update({
        status: "permanently_failed",
        error: "Flow disabled or no webhook URL",
        retry_count: exec.retry_count + 1,
      }).eq("id", exec.id);
      stillFailed++;
      continue;
    }

    try {
      const config = flow.action_config as { url: string; method?: string; headers?: Record<string, string> };
      const res = await fetch(config.url, {
        method: config.method || "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.headers || {}),
        },
        body: JSON.stringify(exec.payload_sent),
        signal: AbortSignal.timeout(5000),
      });

      const responseBody = await res.text().catch(() => "");
      const isSuccess = res.status >= 200 && res.status < 300;

      const newRetryCount = exec.retry_count + 1;

      await db.from("flow_executions").update({
        status: isSuccess ? "success" : (newRetryCount >= MAX_RETRIES ? "permanently_failed" : "failed"),
        response_status_code: res.status,
        response_body: responseBody.slice(0, 1024),
        error: isSuccess ? null : `HTTP ${res.status}`,
        retry_count: newRetryCount,
      }).eq("id", exec.id);

      if (isSuccess) succeeded++;
      else stillFailed++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Retry failed";
      const newRetryCount = exec.retry_count + 1;

      await db.from("flow_executions").update({
        status: newRetryCount >= MAX_RETRIES ? "permanently_failed" : "failed",
        error: message,
        retry_count: newRetryCount,
      }).eq("id", exec.id);

      stillFailed++;
    }
  }

  return NextResponse.json({ retried: failed.length, succeeded, stillFailed });
}
