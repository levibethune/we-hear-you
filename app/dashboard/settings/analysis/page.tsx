"use client";

import { useEffect, useState } from "react";
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
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-lg font-bold">Analysis Configuration</h2>
        <CampaignPicker />
      </div>
      <p className="text-sm text-muted mb-6">
        This is where you control what insights your AI extracts from each response.
        Add fields for the things you care about — themes, sentiment, specific questions
        — and the system will automatically look for them in every new submission. Use
        the preview button to test your setup before saving.
      </p>

      <div className="flex flex-col gap-6">
        <PromptEditor
          value={systemPrompt}
          onChange={setSystemPrompt}
          onSuggest={handleSuggestPrompt}
          suggesting={suggestingPrompt}
        />

        <SchemaBuilder fields={fields} onChange={setFields} />

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="neu-button-primary text-sm"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
          <button
            onClick={() => setPreviewOpen(true)}
            className="text-sm text-accent hover:underline"
          >
            Preview with sample
          </button>
          {saved && (
            <span className="text-sm text-positive">Saved</span>
          )}
        </div>
      </div>

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
