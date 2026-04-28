"use client";

import { useEffect, useState } from "react";

interface Execution {
  id: string;
  created_at: string;
  trigger_event: string;
  trigger_record_id: string;
  status: "success" | "failed" | "skipped";
  response_status_code: number | null;
  response_body: string | null;
  error: string | null;
  payload_sent: unknown;
}

const STATUS_STYLES: Record<string, string> = {
  success: "bg-positive/15 text-positive",
  failed: "bg-negative/15 text-negative",
  skipped: "bg-muted/15 text-muted",
};

const STATUS_LABELS: Record<string, string> = {
  success: "sent",
  failed: "failed",
  skipped: "skipped",
};

const PER_PAGE = 20;

const EVENT_LABELS: Record<string, string> = {
  response_created: "New response",
  person_updated: "Person updated",
  backfill: "Manual send (backfill)",
  test: "Test",
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function FlowHistory({ tenantId, flowId }: { tenantId: string; flowId: string }) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/flows/executions?tenant_id=${tenantId}&flow_id=${flowId}&page=${page}&per_page=${PER_PAGE}`)
      .then((r) => r.json())
      .then((data) => {
        setExecutions(data.executions ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenantId, flowId, page]);

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  function refresh() {
    setLoading(true);
    fetch(`/api/dashboard/flows/executions?tenant_id=${tenantId}&flow_id=${flowId}&page=${page}&per_page=${PER_PAGE}`)
      .then((r) => r.json())
      .then((data) => {
        setExecutions(data.executions ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="soft-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted">
          {loading ? "Loading…" : total === 0 ? "No activity yet" : `${total} ${total === 1 ? "event" : "events"}`}
        </p>
        <button
          type="button"
          onClick={refresh}
          className="text-[10px] text-accent hover:underline"
        >
          Refresh
        </button>
      </div>

      {!loading && total === 0 && (
        <p className="text-xs text-muted">
          Nothing here yet. As responses come in or you trigger backfills, you&apos;ll see what was sent, what failed, and what was filtered out (and why) right here.
        </p>
      )}

      {executions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {executions.map((ex) => {
            const isOpen = expanded.has(ex.id);
            const eventLabel = EVENT_LABELS[ex.trigger_event] ?? ex.trigger_event;
            const recordShort = ex.trigger_record_id?.slice(0, 8) || "—";
            const statusStyle = STATUS_STYLES[ex.status] ?? STATUS_STYLES.failed;
            const statusLabel = STATUS_LABELS[ex.status] ?? ex.status;
            const inlineReason = ex.error || (ex.status === "failed" && ex.response_status_code != null ? `HTTP ${ex.response_status_code}` : null);

            return (
              <div key={ex.id} className="border border-card-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(ex.id)}
                  className="w-full flex flex-col gap-1 px-3 py-2 text-left hover:bg-card-border/20 transition-colors"
                >
                  <div className="flex items-center gap-3 w-full">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${statusStyle}`}>
                      {statusLabel}
                    </span>
                    <span className="text-xs text-muted shrink-0" title={fullTimestamp(ex.created_at)}>
                      {timeAgo(ex.created_at)}
                    </span>
                    <span className="text-xs flex-1 truncate">
                      {eventLabel} <span className="text-muted">·</span> <span className="font-mono text-muted">{recordShort}</span>
                    </span>
                    {ex.response_status_code != null && (
                      <span className="text-[10px] font-mono text-muted shrink-0">HTTP {ex.response_status_code}</span>
                    )}
                    <span className="text-muted text-xs shrink-0">{isOpen ? "▾" : "▸"}</span>
                  </div>
                  {inlineReason && !isOpen && (
                    <p className={`text-[11px] truncate ${ex.status === "failed" ? "text-negative/80" : "text-muted"}`}>
                      {inlineReason}
                    </p>
                  )}
                </button>

                {isOpen && (
                  <div className="px-3 py-2.5 border-t border-card-border bg-card-border/10 text-xs flex flex-col gap-2">
                    <div>
                      <span className="text-muted">When: </span>
                      {fullTimestamp(ex.created_at)}
                    </div>
                    <div>
                      <span className="text-muted">Trigger record: </span>
                      <span className="font-mono">{ex.trigger_record_id}</span>
                    </div>
                    {ex.error && (
                      <div>
                        <p className="text-muted mb-0.5">{ex.status === "skipped" ? "Skip reason" : "Error"}</p>
                        <pre className={`font-mono text-[10px] p-2 rounded whitespace-pre-wrap break-all ${ex.status === "skipped" ? "bg-card-border/30 text-foreground" : "bg-negative/10 text-negative"}`}>{ex.error}</pre>
                      </div>
                    )}
                    {ex.response_body && (
                      <div>
                        <p className="text-muted mb-0.5">Response</p>
                        <pre className="font-mono text-[10px] bg-card-border/30 p-2 rounded whitespace-pre-wrap break-all max-h-40 overflow-auto">{ex.response_body}</pre>
                      </div>
                    )}
                    {ex.payload_sent != null && (
                      <details>
                        <summary className="text-muted cursor-pointer hover:text-foreground">Payload sent</summary>
                        <pre className="font-mono text-[10px] bg-card-border/30 p-2 rounded whitespace-pre-wrap break-all max-h-40 overflow-auto mt-1">{JSON.stringify(ex.payload_sent, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {total > PER_PAGE && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-card-border">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs text-accent hover:underline disabled:opacity-30 disabled:no-underline"
          >
            ← Newer
          </button>
          <span className="text-[10px] text-muted">Page {page} of {lastPage}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
            className="text-xs text-accent hover:underline disabled:opacity-30 disabled:no-underline"
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
}
