"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "../../../components/AuthProvider";
import { FlowPreview } from "../../../components/FlowPreview";
import { FlowExecutionLog } from "../../../components/FlowExecutionLog";
import { LoadingIndicator } from "../../../components/LoadingIndicator";
import type { Flow } from "../../../lib/types";

export default function FlowDetailPage() {
  const { tenant } = useAuthContext();
  const { id } = useParams();
  const router = useRouter();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<{ success: boolean; status?: number; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!tenant || !id) return;
    fetch(`/api/dashboard/flows?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        const found = (data as Flow[]).find((f) => f.id === id);
        setFlow(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant, id]);

  async function handleToggle() {
    if (!tenant || !flow) return;
    await fetch("/api/dashboard/flows", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flow.id, tenant_id: tenant.id, is_active: !flow.is_active }),
    });
    setFlow({ ...flow, is_active: !flow.is_active });
  }

  async function handleDelete() {
    if (!tenant || !flow) return;
    if (!confirm(`Delete "${flow.name}"? This cannot be undone.`)) return;
    await fetch("/api/dashboard/flows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flow.id, tenant_id: tenant.id }),
    });
    router.push("/dashboard/flows");
  }

  async function handleTest() {
    if (!tenant || !flow) return;
    setTesting(true);
    setTestResult(null);

    const res = await fetch("/api/dashboard/flows/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flow.id, tenant_id: tenant.id }),
    });
    const data = await res.json();
    setTestResult({ success: data.success, status: data.status, error: data.error });
    setTesting(false);
  }

  if (loading) return <LoadingIndicator />;

  if (!flow) {
    return (
      <div className="text-center py-16">
        <p className="text-muted">Flow not found.</p>
        <Link href="/dashboard/flows" className="text-sm text-accent hover:underline mt-2 inline-block">
          Back to flows
        </Link>
      </div>
    );
  }

  const webhookUrl = (flow.action_config as { url?: string })?.url || "";

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/flows" className="text-xs text-muted hover:text-foreground mb-3 inline-block">
        &larr; Back to flows
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3 min-w-0">
          {/* Status dot with glow */}
          <span
            className={`inline-block w-3 h-3 rounded-full mt-2 shrink-0 ${
              flow.is_active ? "bg-seafoam" : "bg-muted/30"
            }`}
            style={
              flow.is_active
                ? { boxShadow: "0 0 0 3px rgba(127, 187, 156, 0.25), 0 0 12px rgba(127, 187, 156, 0.55)" }
                : undefined
            }
          />
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{flow.name}</h2>
            {flow.description && (
              <p className="text-sm text-muted mt-0.5">{flow.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleTest}
            disabled={testing}
            className="text-xs text-accent hover:underline disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test webhook"}
          </button>

          {/* On/Off toggle */}
          <button
            onClick={handleToggle}
            aria-label={flow.is_active ? "Pause flow" : "Resume flow"}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              flow.is_active ? "bg-seafoam/40" : "bg-card-border"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                flow.is_active ? "left-[18px] bg-seafoam" : "left-0.5 bg-muted/40"
              }`}
            />
          </button>

          {/* Edit icon */}
          <Link
            href={`/dashboard/flows/${flow.id}/edit`}
            className="text-muted hover:text-accent transition-colors p-1"
            aria-label="Edit flow"
            title="Edit"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </Link>

          {/* Delete icon */}
          <button
            onClick={handleDelete}
            className="text-muted hover:text-negative transition-colors p-1"
            aria-label="Delete flow"
            title="Delete"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`soft-card p-3 mb-4 text-xs ${testResult.success ? "text-positive" : "text-negative"}`}>
          {testResult.success
            ? `Test successful (HTTP ${testResult.status})`
            : `Test failed: ${testResult.error || `HTTP ${testResult.status}`}`}
        </div>
      )}

      {/* Flow config summary */}
      <div className="soft-card p-5 mb-6">
        <FlowPreview
          triggerOn={flow.trigger_on}
          conditions={flow.conditions}
          conditionLogic={flow.condition_logic}
          webhookUrl={webhookUrl}
        />

        <div className="mt-4 pt-3 border-t border-card-border flex flex-wrap gap-4 text-xs text-muted">
          {webhookUrl && (
            <div>
              <span className="text-muted/50">Webhook: </span>
              <span className="font-mono">{(() => { try { const u = new URL(webhookUrl); return `${u.hostname}/...${webhookUrl.slice(-8)}`; } catch { return "configured"; } })()}</span>
            </div>
          )}
          <div>
            <span className="text-muted/50">Logic: </span>
            <span>{flow.condition_logic === "any" ? "Match ANY" : "Match ALL"}</span>
          </div>
          <div>
            <span className="text-muted/50">Created: </span>
            <span>{new Date(flow.created_at).toLocaleDateString()}</span>
          </div>
          {flow.last_triggered_at && (
            <div>
              <span className="text-muted/50">Last fired: </span>
              <span>{new Date(flow.last_triggered_at).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Execution history */}
      <div className="soft-card p-5">
        <h3 className="text-base font-semibold mb-3">Execution History</h3>
        {tenant && <FlowExecutionLog tenantId={tenant.id} flowId={flow.id} />}
      </div>
    </div>
  );
}
