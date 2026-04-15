"use client";

import { useEffect, useState } from "react";
import type { FlowExecution } from "../lib/types";

function StatusDot({ status }: { status: string }) {
  const color =
    status === "success" ? "bg-positive" :
    status === "failed" ? "bg-negative" :
    status === "permanently_failed" ? "bg-negative/50" :
    "bg-muted/30";

  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export function FlowExecutionLog({
  tenantId,
  flowId,
}: {
  tenantId: string;
  flowId?: string;
}) {
  const [executions, setExecutions] = useState<FlowExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (flowId) params.set("flow_id", flowId);
    params.set("per_page", "20");

    fetch(`/api/dashboard/flows/executions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setExecutions(data.executions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenantId, flowId]);

  if (loading) {
    return <p className="text-sm text-muted">Loading executions...</p>;
  }

  if (executions.length === 0) {
    return <p className="text-sm text-muted">No executions yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 text-[10px] text-muted/50 uppercase tracking-wider px-2 pb-1">
        <span />
        <span>Status</span>
        <span>Event</span>
        <span>Time</span>
      </div>
      {executions.map((exec) => (
        <div key={exec.id} className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center text-xs px-2 py-1.5 rounded-lg hover:bg-card-border/20">
          <StatusDot status={exec.status} />
          <span className={exec.status === "success" ? "text-positive" : exec.status === "failed" ? "text-negative" : "text-muted"}>
            {exec.status === "success" ? `OK (${exec.response_status_code})` :
             exec.status === "failed" ? `Failed${exec.retry_count > 0 ? ` (retry ${exec.retry_count})` : ""}` :
             "Permanently failed"}
          </span>
          <span className="text-muted truncate">{exec.trigger_event}</span>
          <span className="text-muted/60">
            {new Date(exec.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
      ))}
    </div>
  );
}
