"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "../../../components/AuthProvider";
import { Modal } from "../../../components/Modal";
import { EmptyState } from "../../../components/EmptyState";
import type { ApiKey } from "../../../lib/types";
import { LoadingIndicator } from "../../../components/LoadingIndicator";

export default function ApiKeysPage() {
  const { tenant } = useAuthContext();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState(tenant?.name ? `${tenant.name} ` : "");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["ingest"]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function fetchKeys() {
    if (!tenant) return;
    fetch(`/api/dashboard/api-keys?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        setKeys(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchKeys(); }, [tenant]);

  async function handleCreate() {
    if (!tenant || !newKeyName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/dashboard/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        name: newKeyName.trim(),
        scopes: newKeyScopes,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.key) {
      setCreatedKey(data.key);
      setNewKeyName(tenant?.name ? `${tenant.name} ` : "");
      setNewKeyScopes(["ingest"]);
      fetchKeys();
    }
  }

  async function handleRevoke(keyId: string) {
    if (!tenant) return;
    await fetch("/api/dashboard/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key_id: keyId, tenant_id: tenant.id }),
    });
    fetchKeys();
  }

  function toggleScope(scope: string) {
    setNewKeyScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  }

  if (loading) {
    return (
      <LoadingIndicator />
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold">API Keys</h2>
          <p className="text-sm text-muted mt-0.5">
            API keys are how external tools (like VideoAsk or a custom form)
            securely send data to your organization. Think of each key as a
            password for a specific connection. We recommend creating a separate
            key for each tool so you can turn off access to one without
            affecting the others.
          </p>
        </div>
        <button
          onClick={() => { setCreateOpen(true); setCreatedKey(null); if (!newKeyName.trim()) setNewKeyName(tenant?.name ? `${tenant.name} ` : ""); }}
          className="bg-accent text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-accent-hover transition-all shadow-[0_2px_8px_rgba(244,160,122,0.25)] shrink-0"
        >
          Generate Key
        </button>
      </div>

      {/* Scope explanations */}
      <div className="soft-card p-4 mb-6">
        <h4 className="text-sm font-medium mb-2">What are scopes?</h4>
        <p className="text-xs text-muted mb-3">
          When you create a key, you choose what it&apos;s allowed to do.
          Only give a key the permissions it needs.
        </p>
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex gap-2">
            <span className="bg-seafoam/10 text-seafoam px-2 py-0.5 rounded-full font-medium shrink-0">ingest</span>
            <span className="text-muted">Can send new responses into your account. This is what most webhook connections need.</span>
          </div>
          <div className="flex gap-2">
            <span className="bg-sunshine/10 text-sunshine px-2 py-0.5 rounded-full font-medium shrink-0">read</span>
            <span className="text-muted">Can read your data (people, responses, analysis). Useful for reporting tools or dashboards.</span>
          </div>
          <div className="flex gap-2">
            <span className="bg-peach/10 text-peach px-2 py-0.5 rounded-full font-medium shrink-0">admin</span>
            <span className="text-muted">Full access — can create other keys, change settings, and manage the account. Use sparingly.</span>
          </div>
        </div>
      </div>

      {keys.length === 0 ? (
        <EmptyState message="No API keys yet. Generate your first key to start connecting tools." />
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">{k.name}</p>
                <p className="text-xs text-muted font-mono">
                  {k.key_prefix}... &middot; {k.scopes.join(", ")}
                </p>
                <p className="text-xs text-muted">
                  {k.last_used_at
                    ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}`
                    : "Never used"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!k.is_active && (
                  <span className="text-xs text-negative">Revoked</span>
                )}
                {k.is_active && (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="text-xs text-negative hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Generate API Key"
      >
        {createdKey ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Copy this key now. You will not see it again.
            </p>
            <code className="text-xs bg-card border border-card-border rounded-lg p-3 font-mono break-all select-all">
              {createdKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey);
              }}
              className="text-sm text-accent hover:underline self-start"
            >
              Copy to clipboard
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={`Key name (e.g., ${tenant?.name ?? "My Org"} VideoAsk webhook)`}
              className="text-sm"
            />
            <div>
              <p className="text-xs text-muted mb-2">Scopes</p>
              <div className="flex gap-3">
                {["ingest", "read", "admin"].map((scope) => (
                  <label key={scope} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={newKeyScopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                    />
                    {scope}
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {creating ? "Generating..." : "Generate"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
