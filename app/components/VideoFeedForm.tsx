"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";
import { ConditionBuilder } from "./ConditionBuilder";
import type { VideoFeed, FlowCondition } from "../lib/types";

const DEFAULT_SAFETY = { no_pii: true, no_profanity: true, no_hate_speech: true, on_topic: true };

export function VideoFeedForm({ existingFeed }: { existingFeed?: VideoFeed }) {
  const { tenant, campaigns, activeCampaign } = useAuthContext();
  const router = useRouter();
  const isEdit = !!existingFeed;

  const [name, setName] = useState(existingFeed?.name ?? "");
  const [description, setDescription] = useState(existingFeed?.description ?? "");
  const [topic, setTopic] = useState(existingFeed?.topic ?? "");
  const [conditions, setConditions] = useState<FlowCondition[]>(
    existingFeed?.conditions && existingFeed.conditions.length > 0
      ? existingFeed.conditions
      : []
  );
  const [conditionLogic, setConditionLogic] = useState<"all" | "any">(existingFeed?.condition_logic ?? "all");
  const [safety, setSafety] = useState(existingFeed?.safety_required ?? DEFAULT_SAFETY);
  const [campaignScope, setCampaignScope] = useState<string | null>(existingFeed?.campaign_id ?? activeCampaign?.id ?? null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [personas, setPersonas] = useState<string[]>([]);
  const [forms, setForms] = useState<string[]>([]);

  useEffect(() => {
    if (!tenant) return;
    fetch(`/api/dashboard/taxonomies?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => setPersonas((data.buckets ?? []).map((b: { name: string }) => b.name)))
      .catch(() => {});

    fetch(`/api/dashboard/responses?tenant_id=${tenant.id}&per_page=100`)
      .then((r) => r.json())
      .then((data) => {
        const names = new Set<string>();
        for (const r of data.responses ?? []) {
          if (r.source_form_name) names.add(r.source_form_name);
        }
        setForms(Array.from(names));
      })
      .catch(() => {});
  }, [tenant]);

  async function handleSave() {
    if (!tenant || !name.trim()) return;
    setSaving(true);
    setError(null);

    const cleanConditions = conditions.filter((c) => c.value !== "" && (typeof c.value !== "object" || c.value.length > 0));

    const res = await fetch("/api/dashboard/video-feeds", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEdit ? { feed_id: existingFeed.id } : {}),
        tenant_id: tenant.id,
        campaign_id: campaignScope,
        name: name.trim(),
        description: description.trim() || null,
        topic: topic.trim() || null,
        conditions: cleanConditions,
        condition_logic: conditionLogic,
        safety_required: safety,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (data.error) {
      setError(data.error);
      return;
    }

    router.push("/dashboard/outputs");
  }

  async function handleDelete() {
    if (!tenant || !existingFeed) return;
    if (!confirm(`Delete "${existingFeed.name}"? Anyone with the public URL will lose access.`)) return;
    await fetch("/api/dashboard/video-feeds", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_id: existingFeed.id, tenant_id: tenant.id }),
    });
    router.push("/dashboard/outputs");
  }

  function toggleSafety(key: keyof typeof safety) {
    setSafety({ ...safety, [key]: !safety[key] });
  }

  const publicUrl = existingFeed && typeof window !== "undefined"
    ? `${window.location.origin}/feeds/${existingFeed.slug}`
    : null;

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold mb-1">{isEdit ? "Edit Video Feed" : "Create Video Feed"}</h2>
      <p className="text-sm text-muted mb-6">
        Publish a curated, safety-filtered video feed that you can embed anywhere.
      </p>

      {/* Public URL & embed (edit mode only) */}
      {isEdit && publicUrl && (
        <div className="soft-card p-4 mb-6">
          <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Public URL</label>
          <div className="flex items-center gap-2 mb-3">
            <code className="text-xs font-mono bg-card-border/30 px-2 py-1 rounded flex-1 truncate">{publicUrl}</code>
            <button
              onClick={() => navigator.clipboard.writeText(publicUrl)}
              className="text-xs text-accent hover:underline shrink-0"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-muted/70">
            Embed in any site with: <code className="font-mono">&lt;iframe src=&quot;{publicUrl}&quot;&gt;&lt;/iframe&gt;</code>
          </p>
          <p className="text-xs text-muted/70 mt-1">
            Or fetch JSON from: <code className="font-mono">/api/feeds/{existingFeed.slug}</code>
          </p>
        </div>
      )}

      {/* Campaign scope */}
      {campaigns.length > 1 && (
        <div className="mb-6">
          <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Scope</label>
          <select
            value={campaignScope ?? ""}
            onChange={(e) => setCampaignScope(e.target.value || null)}
            className="text-sm"
          >
            <option value="">All Campaigns (org-wide)</option>
            {campaigns.filter((c) => !c.is_archived).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Name & Description */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Customer Stories"
          className="text-sm w-full"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          className="text-sm w-full mt-2"
        />
      </div>

      {/* Topic */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Topic</label>
        <div className="soft-card p-4">
          <p className="text-xs text-muted mb-2">
            Describe what this feed is about. Used to filter out off-topic videos.
          </p>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., cooking and recipes"
            className="text-sm w-full"
          />
        </div>
      </div>

      {/* Conditions */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Which videos should appear?</label>
        <div className="soft-card p-4">
          {conditions.length === 0 ? (
            <p className="text-xs text-muted mb-3">No conditions — all videos that pass safety filters will appear. Add conditions to narrow it down.</p>
          ) : null}
          <ConditionBuilder
            conditions={conditions}
            conditionLogic={conditionLogic}
            personas={personas}
            forms={forms}
            campaigns={campaigns}
            onChange={setConditions}
            onLogicChange={setConditionLogic}
          />
        </div>
      </div>

      {/* Safety rules */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Safety filters</label>
        <div className="soft-card p-4 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={safety.no_pii} onChange={() => toggleSafety("no_pii")} />
            <span>Hide videos containing personal information (PII)</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={safety.no_profanity} onChange={() => toggleSafety("no_profanity")} />
            <span>Hide videos with profanity</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={safety.no_hate_speech} onChange={() => toggleSafety("no_hate_speech")} />
            <span>Hide videos with hate speech or harassment</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={safety.on_topic} onChange={() => toggleSafety("on_topic")} disabled={!topic.trim()} />
            <span className={!topic.trim() ? "text-muted" : ""}>
              Hide off-topic videos {!topic.trim() && "(set a topic above to enable)"}
            </span>
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-negative mb-3">{error}</p>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-accent text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-accent-hover transition-all shadow-[0_2px_8px_rgba(244,160,122,0.25)] disabled:opacity-50"
          >
            {saving ? "Saving..." : (isEdit ? "Save Changes" : "Create Feed")}
          </button>
          <button
            onClick={() => router.push("/dashboard/outputs")}
            className="text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
        {isEdit && (
          <button onClick={handleDelete} className="text-xs text-negative hover:underline">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
