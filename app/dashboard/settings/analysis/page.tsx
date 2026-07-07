"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuthContext } from "../../../components/AuthProvider";
import { PromptEditor } from "../../../components/PromptEditor";
import { SchemaBuilder, fieldsToSchema, schemaToFields } from "../../../components/SchemaBuilder";
import { Modal } from "../../../components/Modal";
import type { SchemaField } from "../../../components/SchemaFieldRow";
import { LoadingIndicator } from "../../../components/LoadingIndicator";
import { OrgBanner } from "../../../components/OrgBanner";
import { CampaignPicker } from "../../../components/CampaignPicker";
import { track } from "../../../lib/analytics";

export default function AnalysisConfigPage() {
  const { tenant, activeCampaign } = useAuthContext();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reanalyzeOpen, setReanalyzeOpen] = useState(false);
  const [campaignCount, setCampaignCount] = useState<number | null>(null);
  const [orgCount, setOrgCount] = useState<number | null>(null);
  const [reanalyzeStatus, setReanalyzeStatus] = useState("");

  const initialLoadDone = useRef(false);

  // Auto-save with debounce
  const autoSave = useCallback(async () => {
    if (!tenant || !activeCampaign || !initialLoadDone.current) return;
    setSaving(true);
    await fetch("/api/dashboard/analysis-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        campaign_id: activeCampaign.id,
        system_prompt: systemPrompt,
        output_schema: fieldsToSchema(fields),
        model,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [tenant, activeCampaign, systemPrompt, fields, model]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    const timer = setTimeout(autoSave, 1500);
    return () => clearTimeout(timer);
  }, [systemPrompt, fields, model, autoSave]);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Suggest prompt state
  const [suggestingPrompt, setSuggestingPrompt] = useState(false);
  const [personas, setPersonas] = useState<{ name: string; description: string; criteria: string }[]>([]);

  useEffect(() => {
    if (!tenant) return;
    Promise.all([
      fetch(`/api/dashboard/analysis-config?tenant_id=${tenant.id}${activeCampaign ? `&campaign_id=${activeCampaign.id}` : ""}`).then(r => r.json()),
      fetch(`/api/dashboard/taxonomies?tenant_id=${tenant.id}${activeCampaign ? `&campaign_id=${activeCampaign.id}` : ""}`).then(r => r.json()),
    ]).then(([config, taxonomy]) => {
      if (config.system_prompt) setSystemPrompt(config.system_prompt);
      if (config.output_schema) setFields(schemaToFields(config.output_schema));
      if (config.model) setModel(config.model);
      if (taxonomy.buckets) setPersonas(taxonomy.buckets);
      setLoading(false);
      setTimeout(() => { initialLoadDone.current = true; }, 100);
    }).catch(() => setLoading(false));
  }, [tenant]);

  async function handleSuggestPrompt() {
    if (!tenant) return;
    setSuggestingPrompt(true);
    const res = await fetch("/api/dashboard/analysis-config/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        ...(activeCampaign ? { campaign_id: activeCampaign.id } : {}),
        fields: fields.map(f => ({ name: f.name, type: f.type, description: f.description })),
        personas,
      }),
    });
    const data = await res.json();
    setSuggestingPrompt(false);
    if (data.prompt) setSystemPrompt(data.prompt);
  }

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    setSaved(false);
    await fetch("/api/dashboard/analysis-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        ...(activeCampaign ? { campaign_id: activeCampaign.id } : {}),
        system_prompt: systemPrompt,
        output_schema: fieldsToSchema(fields),
        model,
      }),
    });
    setSaving(false);
    setSaved(true);
    track("analysis_config_saved", { field_count: fields.length });
    setTimeout(() => setSaved(false), 3000);
  }

  async function openReanalyze() {
    if (!tenant) return;
    setReanalyzeStatus("");
    setCampaignCount(null);
    setOrgCount(null);
    setReanalyzeOpen(true);
    const base = `/api/dashboard/responses?tenant_id=${tenant.id}&ids_only=true`;
    const [campaignRes, orgRes] = await Promise.all([
      activeCampaign
        ? fetch(`${base}&campaign_id=${activeCampaign.id}`).then((r) => r.json())
        : Promise.resolve({ total: 0 }),
      fetch(base).then((r) => r.json()),
    ]);
    setCampaignCount(campaignRes.total ?? 0);
    setOrgCount(orgRes.total ?? 0);
  }

  async function launchReanalyze(scope: "campaign" | "tenant") {
    if (!tenant) return;
    setReanalyzeStatus("Starting...");
    const res = await fetch("/api/dashboard/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        ...(scope === "campaign" && activeCampaign ? { campaign_id: activeCampaign.id } : {}),
        type: "bulk_reanalyze",
        params: scope === "campaign"
          ? { scope: "campaign", campaign_id: activeCampaign?.id }
          : { scope: "tenant" },
      }),
    });
    if (res.status === 409) {
      setReanalyzeStatus("A re-analysis is already running — watch its progress above.");
      return;
    }
    if (!res.ok) {
      setReanalyzeStatus("Couldn't start re-analysis. Try again.");
      return;
    }
    track("bulk_reanalyze", { scope });
    setReanalyzeOpen(false);
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewResult(null);
    const res = await fetch("/api/dashboard/analysis-config/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant?.id,
        transcription: previewText,
        system_prompt: systemPrompt,
        output_schema: fieldsToSchema(fields),
        model,
      }),
    });
    const data = await res.json();
    setPreviewResult(data.result ?? data);
    setPreviewLoading(false);
  }

  if (loading) {
    return (
      <LoadingIndicator />
    );
  }

  if (!activeCampaign) {
    return (
      <div className="max-w-2xl">
        <OrgBanner />
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-bold">Analysis Configuration</h2>
          <CampaignPicker />
        </div>
        <div className="soft-card p-6 text-center mt-4">
          <p className="text-sm text-muted mb-2">Analysis config is set per campaign.</p>
          <p className="text-sm text-muted">Select a campaign to configure its analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <OrgBanner />
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">Analysis Configuration</h2>
          <CampaignPicker />
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-[10px] text-muted animate-pulse">Saving...</span>}
          {saved && !saving && <span className="text-[10px] text-seafoam">Saved</span>}
          <button
            onClick={openReanalyze}
            className="text-xs text-seafoam hover:underline"
          >
            Re-analyze all
          </button>
          <button
            onClick={() => setPreviewOpen(true)}
            className="text-xs text-accent hover:underline"
          >
            Preview with sample
          </button>
        </div>
      </div>
      <p className="text-sm text-muted mb-6">
        This is where you control what insights your AI extracts from each response.
        Add fields for the things you care about — themes, sentiment, specific questions
        — and the system will automatically look for them in every new submission.
      </p>

      <div className="flex flex-col gap-6">
        <PromptEditor
          value={systemPrompt}
          onChange={setSystemPrompt}
          onSuggest={handleSuggestPrompt}
          suggesting={suggestingPrompt}
        />

        <SchemaBuilder fields={fields} onChange={setFields} />

      </div>

      <Modal
        open={reanalyzeOpen}
        onClose={() => setReanalyzeOpen(false)}
        title="Re-analyze responses"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Re-run AI analysis with the current criteria. This re-analyzes every
            response in the chosen scope and may take a few minutes.
          </p>
          <button
            onClick={() => launchReanalyze("campaign")}
            disabled={campaignCount === null || campaignCount === 0}
            className="soft-card p-3 text-left hover:shadow-lg transition-all disabled:opacity-50"
          >
            <p className="text-sm font-medium">This campaign</p>
            <p className="text-xs text-muted">
              Apply the criteria you just changed to all{" "}
              {campaignCount === null ? "…" : campaignCount} responses in this campaign.
            </p>
          </button>
          <button
            onClick={() => launchReanalyze("tenant")}
            disabled={orgCount === null || orgCount === 0}
            className="soft-card p-3 text-left hover:shadow-lg transition-all disabled:opacity-50"
          >
            <p className="text-sm font-medium">Whole org</p>
            <p className="text-xs text-muted">
              Refresh all {orgCount === null ? "…" : orgCount} responses across your
              organization. Each is re-run under its own campaign&apos;s criteria, not
              just this campaign&apos;s.
            </p>
          </button>
          {reanalyzeStatus && <p className="text-xs text-muted">{reanalyzeStatus}</p>}
        </div>
      </Modal>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Preview Analysis"
      >
        <div className="flex flex-col gap-4">
          <textarea
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Paste a sample transcription here..."
            rows={5}
            className="text-sm w-full"
          />
          <button
            onClick={handlePreview}
            disabled={previewLoading || !previewText.trim()}
            className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {previewLoading ? "Analyzing..." : "Run Preview"}
          </button>
          {previewResult && (
            <pre className="bg-card border border-card-border rounded-lg p-3 text-xs font-mono overflow-x-auto">
              {JSON.stringify(previewResult, null, 2)}
            </pre>
          )}
        </div>
      </Modal>
    </div>
  );
}
