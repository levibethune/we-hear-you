"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "../../../components/AuthProvider";
import { Modal } from "../../../components/Modal";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingIndicator } from "../../../components/LoadingIndicator";
import { SetupWizard } from "../../../components/SetupWizard";
import type { Campaign } from "../../../lib/types";

export default function CampaignsSettingsPage() {
  const { tenant, refreshCampaigns } = useAuthContext();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFormNames, setNewFormNames] = useState("");
  const [creating, setCreating] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<Campaign | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [availableFormNames, setAvailableFormNames] = useState<string[]>([]);

  function fetchCampaigns() {
    if (!tenant) return;
    fetch(`/api/dashboard/campaigns?tenant_id=${tenant.id}&include_archived=true`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(Array.isArray(data) ? data : []);
        setLoading(false);
        refreshCampaigns();
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchCampaigns();
    // Fetch all known form names from responses
    if (tenant) {
      fetch(`/api/dashboard/responses?tenant_id=${tenant.id}&per_page=100`)
        .then((r) => r.json())
        .then((data) => {
          const names = new Set<string>();
          for (const r of data.responses ?? []) {
            if (r.source_form_name) names.add(r.source_form_name);
          }
          setAvailableFormNames(Array.from(names).sort());
        })
        .catch(() => {});
    }
  }, [tenant]);

  // Fetch response counts per campaign
  useEffect(() => {
    if (!tenant || campaigns.length === 0) return;
    Promise.all(
      campaigns.map((c) =>
        fetch(`/api/dashboard/stats?tenant_id=${tenant.id}&campaign_id=${c.id}`)
          .then((r) => r.json())
          .then((data) => [c.id, data.totalResponses ?? 0] as [string, number])
          .catch(() => [c.id, 0] as [string, number])
      )
    ).then((pairs) => {
      setResponseCounts(Object.fromEntries(pairs));
    });
  }, [tenant, campaigns.length]);

  async function handleCreate() {
    if (!tenant || !newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/dashboard/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        name: newName.trim(),
        description: newDescription.trim() || null,
        form_names: newFormNames.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    setCreating(false);
    if (res.ok) {
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      setNewFormNames("");
      fetchCampaigns();
    }
  }

  async function handleDuplicate() {
    if (!tenant || !duplicateSource || !duplicateName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/dashboard/campaigns/duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        source_campaign_id: duplicateSource.id,
        new_name: duplicateName.trim(),
      }),
    });
    setCreating(false);
    if (res.ok) {
      setDuplicateSource(null);
      setDuplicateName("");
      fetchCampaigns();
    }
  }

  async function handleArchive(campaign: Campaign) {
    if (!tenant) return;
    if (!confirm(`Archive "${campaign.name}"? It will be hidden from the campaign picker but its data will remain.`)) return;
    await fetch("/api/dashboard/campaigns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaign.id, tenant_id: tenant.id, is_archived: true }),
    });
    fetchCampaigns();
  }

  async function handleUnarchive(campaign: Campaign) {
    if (!tenant) return;
    await fetch("/api/dashboard/campaigns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaign.id, tenant_id: tenant.id, is_archived: false }),
    });
    fetchCampaigns();
  }

  async function handleDelete(campaign: Campaign) {
    if (!tenant) return;
    if (!confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return;
    const res = await fetch("/api/dashboard/campaigns", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaign.id, tenant_id: tenant.id }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      fetchCampaigns();
    }
  }

  async function handleSaveEdit() {
    if (!tenant || !editCampaign) return;
    await fetch("/api/dashboard/campaigns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: editCampaign.id,
        tenant_id: tenant.id,
        name: editCampaign.name,
        description: editCampaign.description,
        form_names: editCampaign.form_names,
      }),
    });
    setEditCampaign(null);
    fetchCampaigns();
  }

  if (loading) return <LoadingIndicator />;

  const activeCampaigns = campaigns.filter((c) => !c.is_archived);
  const archivedCampaigns = campaigns.filter((c) => c.is_archived);

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold">Campaigns</h2>
          <p className="text-sm text-muted mt-0.5">
            Organize your data collection efforts. Each campaign gets its own
            Persona config, Analysis config, and can have different form
            connections routed to it.
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="bg-accent text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-accent-hover transition-all shadow-[0_2px_8px_rgba(244,160,122,0.25)] shrink-0"
        >
          New Campaign
        </button>
      </div>

      {wizardOpen && (
        <div className="mb-8 soft-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">New Campaign Setup</h3>
            <button onClick={() => setWizardOpen(false)} className="text-xs text-muted hover:text-foreground">Cancel</button>
          </div>
          <SetupWizard
            mode="campaign"
            existingFormNames={availableFormNames}
            onComplete={() => {
              setWizardOpen(false);
              fetchCampaigns();
            }}
          />
        </div>
      )}

      {activeCampaigns.length === 0 ? (
        <EmptyState message="No campaigns yet." />
      ) : (
        <div className="flex flex-col gap-2">
          {activeCampaigns.map((c) => (
            <div key={c.id} className="soft-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{c.name}</h3>
                  </div>
                  {c.description && (
                    <p className="text-xs text-muted mt-0.5">{c.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted/60">
                    <span>{responseCounts[c.id] ?? 0} responses</span>
                    {c.form_names.length > 0 && (
                      <span>Forms: {c.form_names.join(", ")}</span>
                    )}
                    <span>Created {new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <button
                    onClick={() => setEditCampaign({ ...c })}
                    className="text-muted hover:text-accent"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setDuplicateSource(c); setDuplicateName(`${c.name} (copy)`); }}
                    className="text-muted hover:text-accent"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => handleArchive(c)}
                    className="text-muted hover:text-foreground"
                  >
                    Archive
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="text-muted hover:text-negative"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {archivedCampaigns.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-muted mb-2">Archived</h3>
          <div className="flex flex-col gap-2">
            {archivedCampaigns.map((c) => (
              <div key={c.id} className="soft-card p-4 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm">{c.name}</h4>
                    <p className="text-[10px] text-muted">{responseCounts[c.id] ?? 0} responses</p>
                  </div>
                  <button
                    onClick={() => handleUnarchive(c)}
                    className="text-xs text-accent hover:underline"
                  >
                    Unarchive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Campaign">
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Campaign name"
            className="text-sm"
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="text-sm"
          />
          <div>
            <label className="text-xs text-muted block mb-1">
              Form names — responses from these forms auto-route to this campaign
            </label>
            {availableFormNames.length > 0 ? (
              <div className="flex flex-col gap-1.5 soft-card p-3 max-h-40 overflow-y-auto">
                {availableFormNames.map((fn) => {
                  const selected = newFormNames.split(",").map((s) => s.trim()).filter(Boolean);
                  const isSelected = selected.includes(fn);
                  return (
                    <label key={fn} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          const next = isSelected
                            ? selected.filter((s) => s !== fn)
                            : [...selected, fn];
                          setNewFormNames(next.join(", "));
                        }}
                      />
                      {fn}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted">No forms found yet. Import some responses first.</p>
            )}
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Campaign"}
          </button>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editCampaign} onClose={() => setEditCampaign(null)} title="Edit Campaign">
        {editCampaign && (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={editCampaign.name}
              onChange={(e) => setEditCampaign({ ...editCampaign, name: e.target.value })}
              className="text-sm"
            />
            <input
              type="text"
              value={editCampaign.description || ""}
              onChange={(e) => setEditCampaign({ ...editCampaign, description: e.target.value })}
              placeholder="Description"
              className="text-sm"
            />
            <div>
              <label className="text-xs text-muted block mb-1">Form names — auto-route matching responses here</label>
              {availableFormNames.length > 0 ? (
                <div className="flex flex-col gap-1.5 soft-card p-3 max-h-40 overflow-y-auto">
                  {availableFormNames.map((fn) => {
                    const isSelected = editCampaign.form_names.includes(fn);
                    return (
                      <label key={fn} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const next = isSelected
                              ? editCampaign.form_names.filter((s) => s !== fn)
                              : [...editCampaign.form_names, fn];
                            setEditCampaign({ ...editCampaign, form_names: next });
                          }}
                        />
                        {fn}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted">No forms found yet.</p>
              )}
            </div>
            <button
              onClick={handleSaveEdit}
              className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover"
            >
              Save Changes
            </button>
          </div>
        )}
      </Modal>

      {/* Duplicate modal */}
      <Modal open={!!duplicateSource} onClose={() => setDuplicateSource(null)} title="Duplicate Campaign">
        {duplicateSource && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted">
              Creates a new campaign with the same Persona and Analysis config as <strong>{duplicateSource.name}</strong>. Responses and flows are not copied.
            </p>
            <input
              type="text"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="New campaign name"
              className="text-sm"
            />
            <button
              onClick={handleDuplicate}
              disabled={creating || !duplicateName.trim()}
              className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
            >
              {creating ? "Duplicating..." : "Duplicate"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
