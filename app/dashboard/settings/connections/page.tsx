"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "../../../components/AuthProvider";
import { Modal } from "../../../components/Modal";
import { EmptyState } from "../../../components/EmptyState";
import type { ApiKey, Source } from "../../../lib/types";
import { LoadingIndicator } from "../../../components/LoadingIndicator";
import { OrgBanner } from "../../../components/OrgBanner";
import { CopyField } from "../../../components/CopyField";

export default function ConnectionsPage() {
  const { tenant } = useAuthContext();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRevoked, setShowRevoked] = useState(false);

  // Key creation state
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["ingest"]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  function fetchData() {
    if (!tenant) return;
    Promise.all([
      fetch(`/api/dashboard/api-keys?tenant_id=${tenant.id}`).then((r) => r.json()),
      fetch(`/api/dashboard/sources?tenant_id=${tenant.id}`).then((r) => r.json()),
    ]).then(([keysData, sourcesData]) => {
      setKeys(Array.isArray(keysData) ? keysData : []);
      setSources(Array.isArray(sourcesData) ? sourcesData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, [tenant]);

  function openGenerateModal(prefillName?: string) {
    setCreatedKey(null);
    setCopied(false);
    setNewKeyName(prefillName ?? "");
    setNewKeyScopes(["ingest"]);
    setCreateOpen(true);
  }

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
      setNewKeyName("");
      setNewKeyScopes(["ingest"]);
      setCopied(false);
      fetchData();
    }
  }

  async function handleRevoke(keyId: string) {
    if (!tenant) return;
    await fetch("/api/dashboard/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key_id: keyId, tenant_id: tenant.id }),
    });
    fetchData();
  }

  function toggleScope(scope: string) {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const activeKeys = keys.filter((k) => k.is_active);
  const revokedKeys = keys.filter((k) => !k.is_active);
  const bearerValue = createdKey ? `Bearer ${createdKey}` : "";

  if (loading) {
    return (
      <LoadingIndicator />
    );
  }

  return (
    <div className="max-w-2xl">
      <OrgBanner />
      <h2 className="text-lg font-bold mb-1">Connections</h2>
      <p className="text-sm text-muted mb-6">
        Connect external tools to your organization so that responses flow in
        automatically. Follow the step-by-step guide for your tool, and
        you&apos;ll be up and running in a few minutes.
      </p>

      {/* ===== VIDEOASK GUIDE ===== */}
      <div className="soft-card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold">Connect VideoAsk</h3>
          <span className="text-xs text-seafoam bg-seafoam/10 px-2 py-0.5 rounded-full">Step-by-step</span>
        </div>

        <ol className="text-sm text-muted flex flex-col gap-3 list-none">
          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">1. Open webhook settings in VideoAsk</p>
            <p className="text-xs">
              Open the form you want to connect. Go to{" "}
              <strong>Settings &rarr; Notifications &rarr; Webhooks</strong>{" "}
              and click <strong>&ldquo;Add a Webhook.&rdquo;</strong>
            </p>
          </li>

          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">2. Set the URL</p>
            <p className="text-xs mb-2">Paste this into the URL field:</p>
            <CopyField value="https://app.wehearyou.io/api/ingest/videoask" />
          </li>

          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">3. Turn on events</p>
            <p className="text-xs mb-2">Toggle on these two events:</p>
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-seafoam"></span>
                <span className="font-mono">form_response</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-seafoam"></span>
                <span className="font-mono">form_response_transcribed</span>
              </div>
            </div>
            <p className="text-xs mt-1.5">Leave all other events off.</p>
          </li>

          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">4. Add the secret</p>
            <p className="text-xs mb-3">
              Scroll down to <strong>&ldquo;Add a secret.&rdquo;</strong>{" "}
              Fill in the Header name, generate a key, then paste the value.
            </p>
            <div className="flex flex-col gap-3 text-xs">
              <CopyField label="Header name:" value="Authorization" />
              <div>
                <span className="text-muted block mb-1.5">Value:</span>
                <button
                  onClick={() => openGenerateModal("VideoAsk webhook")}
                  className="neu-button-primary text-sm mb-2"
                >
                  Generate Key for VideoAsk
                </button>
                <p className="text-xs text-muted">
                  After generating, a green box will appear with the value to paste.
                  It starts with <span className="font-mono">Bearer why_</span> —
                  copy the whole thing.
                </p>
              </div>
            </div>
          </li>

          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">5. Save</p>
            <p className="text-xs">
              Click <strong>Save</strong> in VideoAsk. New responses will now
              appear in your dashboard automatically.
            </p>
          </li>
        </ol>
      </div>

      {/* ===== CUSTOM ENDPOINT ===== */}
      <div className="soft-card p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold">Other tools</h3>
          <span className="text-xs text-sunshine bg-sunshine/10 px-2 py-0.5 rounded-full">Any webhook</span>
        </div>
        <p className="text-xs text-muted mb-3">
          Any tool that supports webhooks can send data to We Hear You.
          Point it at this URL and include your API key in the Authorization header.
        </p>

        <button
          onClick={() => openGenerateModal("")}
          className="text-xs text-accent hover:underline mb-3"
        >
          Generate a key for this connection
        </button>

        <div className="mb-3">
          <CopyField value="https://app.wehearyou.io/api/ingest/custom" />
        </div>
        <p className="text-xs text-muted mb-2">Required JSON fields:</p>
        <div className="flex flex-col gap-1 text-xs mb-3">
          <div className="flex gap-2">
            <code className="font-mono text-foreground">email</code>
            <span className="text-muted">— respondent&apos;s email</span>
          </div>
          <div className="flex gap-2">
            <code className="font-mono text-foreground">transcription</code>
            <span className="text-muted">— text to analyze</span>
          </div>
        </div>
        <p className="text-xs text-muted">
          Optional: <code className="font-mono">name</code>,{" "}
          <code className="font-mono">media_url</code>
        </p>
      </div>

      {/* ===== API KEYS ===== */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-bold">API Keys</h3>
          <p className="text-sm text-muted mt-0.5">
            Each key is like a password for a specific connection. Create a
            separate key for each tool so you can turn off access to one
            without affecting the others.
          </p>
        </div>
        <button
          onClick={() => openGenerateModal("")}
          className="bg-accent text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-accent-hover transition-all shadow-[0_2px_8px_rgba(244,160,122,0.25)] shrink-0"
        >
          Generate Key
        </button>
      </div>

      {/* Scope explainer */}
      <details className="mb-4">
        <summary className="text-xs text-accent cursor-pointer hover:underline">
          What are scopes?
        </summary>
        <div className="soft-card p-4 mt-2">
          <p className="text-xs text-muted mb-3">
            When you create a key, you choose what it&apos;s allowed to do.
            Only give a key the permissions it needs.
          </p>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex gap-2">
              <span className="bg-seafoam/10 text-seafoam px-2 py-0.5 rounded-full font-medium shrink-0">ingest</span>
              <span className="text-muted">Can send new responses into your account. This is what most connections need.</span>
            </div>
            <div className="flex gap-2">
              <span className="bg-sunshine/10 text-sunshine px-2 py-0.5 rounded-full font-medium shrink-0">read</span>
              <span className="text-muted">Can read your data. Useful for reporting tools.</span>
            </div>
            <div className="flex gap-2">
              <span className="bg-peach/10 text-peach px-2 py-0.5 rounded-full font-medium shrink-0">admin</span>
              <span className="text-muted">Full access. Use sparingly.</span>
            </div>
          </div>
        </div>
      </details>

      {/* Active keys */}
      {activeKeys.length === 0 ? (
        <div className="mb-4">
          <EmptyState message="No API keys yet. Generate one using the button above or from the setup guides." />
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {activeKeys.map((k) => (
            <div
              key={k.id}
              className="soft-card px-4 py-3 flex items-center justify-between"
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
              <button
                onClick={() => handleRevoke(k.id)}
                className="text-xs text-negative hover:underline"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <div className="mb-8">
          <button
            onClick={() => setShowRevoked(!showRevoked)}
            className="text-xs text-muted hover:text-foreground transition-colors mb-2"
          >
            {showRevoked ? "Hide" : "Show"}{" "}
            {revokedKeys.length} revoked key{revokedKeys.length !== 1 ? "s" : ""}
          </button>
          {showRevoked && (
            <div className="flex flex-col gap-2">
              {revokedKeys.map((k) => (
                <div
                  key={k.id}
                  className="soft-card px-4 py-3 flex items-center justify-between opacity-50"
                >
                  <div>
                    <p className="text-sm font-medium line-through">{k.name}</p>
                    <p className="text-xs text-muted font-mono">
                      {k.key_prefix}... &middot; revoked
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="text-xs text-muted hover:text-negative transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== ACTIVE SOURCES ===== */}
      <h3 className="text-base font-bold mb-1">Active Sources</h3>
      <p className="text-sm text-muted mb-3">
        Tools that have successfully sent at least one response.
      </p>
      {sources.length === 0 ? (
        <EmptyState message="No sources connected yet. Once a webhook sends its first response, it will appear here." />
      ) : (
        <div className="flex flex-col gap-2">
          {sources.map((s) => (
            <div
              key={s.id}
              className="soft-card px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted">{s.type}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  s.is_active
                    ? "bg-positive/15 text-positive"
                    : "bg-neutral/15 text-neutral"
                }`}
              >
                {s.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Generate Key Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createdKey ? "Your new API key" : "Generate API Key"}
      >
        {createdKey ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Your key has been created. Copy the value below and paste it
              directly into your tool&apos;s <strong>Value</strong> field.
              It includes everything you need — no editing required.
            </p>

            <div>
              <p className="text-xs text-muted mb-1.5">
                Copy this entire value:
              </p>
              <div className="bg-seafoam/10 border border-seafoam/20 rounded-xl p-3">
                <code className="text-xs font-mono text-foreground break-all select-all">
                  {bearerValue}
                </code>
              </div>
            </div>

            <button
              onClick={() => copyToClipboard(bearerValue)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                copied
                  ? "bg-seafoam/15 text-seafoam"
                  : "bg-accent text-white hover:bg-accent-hover shadow-[0_2px_8px_rgba(244,160,122,0.25)]"
              }`}
            >
              {copied ? "Copied to clipboard" : "Copy to clipboard"}
            </button>

            <p className="text-xs text-muted text-center">
              This is the only time this key will be shown. If you lose it,
              generate a new one.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Give your key a name so you remember what it&apos;s for.
            </p>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., VideoAsk webhook"
              className="text-sm"
              autoFocus
            />
            <div>
              <p className="text-xs text-muted mb-2">Permissions</p>
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
              <p className="text-xs text-muted mt-1.5">
                For a webhook connection, &ldquo;ingest&rdquo; is all you need.
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="bg-accent text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-accent-hover transition-all disabled:opacity-50"
            >
              {creating ? "Generating..." : "Generate"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
