"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";
import { ConditionBuilder } from "./ConditionBuilder";
import { useCustomAnalysisFields } from "../hooks/useCustomAnalysisFields";
import { FlowPreview } from "./FlowPreview";
import type { Flow, FlowCondition } from "../lib/types";

const FIELD_LABELS: Record<string, string> = {
  sentiment: "sentiment",
  mood: "mood",
  persona: "persona",
  themes: "themes",
  source_type: "source",
  source_form_name: "form",
  transcription: "transcription",
};

const OPERATOR_LABELS: Record<string, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  not_contains: "doesn't contain",
  in: "is one of",
  not_in: "is not one of",
};

function generateName(conditions: FlowCondition[], webhookUrl: string, campaignMap?: Record<string, string>): string {
  const destination = webhookUrl.includes("zapier") ? "Zapier" : webhookUrl.includes("make.com") || webhookUrl.includes("integromat") ? "Make" : "webhook";
  if (conditions.length === 0 || !conditions.some((c) => c.value)) return "";

  const parts = conditions
    .filter((c) => c.value)
    .map((c) => {
      let val = Array.isArray(c.value) ? c.value.join("/") : c.value;
      if (c.field === "campaign" && campaignMap && campaignMap[val]) val = campaignMap[val];
      return `${FIELD_LABELS[c.field] || c.field} ${OPERATOR_LABELS[c.operator] || c.operator} ${val}`;
    });

  const summary = parts.join(" + ");
  return `${summary} → ${destination}`;
}

function generateDescription(conditions: FlowCondition[], triggerOn: string, webhookUrl: string): string {
  const destination = webhookUrl.includes("zapier") ? "Zapier" : webhookUrl.includes("make.com") || webhookUrl.includes("integromat") ? "Make" : "webhook";
  const trigger = triggerOn === "both" ? "new responses or reanalysis" : triggerOn === "response_created" ? "new responses" : "person updates";

  if (conditions.length === 0 || !conditions.some((c) => c.value)) return "";

  return `Send to ${destination} on ${trigger} when conditions match.`;
}

export function FlowForm({ existingFlow }: { existingFlow?: Flow }) {
  const { tenant, campaigns, activeCampaign } = useAuthContext();
  const router = useRouter();
  const isEdit = !!existingFlow;

  const [name, setName] = useState(existingFlow?.name ?? "");
  const [nameEdited, setNameEdited] = useState(isEdit);
  const [description, setDescription] = useState(existingFlow?.description ?? "");
  const [descriptionEdited, setDescriptionEdited] = useState(isEdit);
  const [triggerOn, setTriggerOn] = useState<"response_created" | "person_updated" | "both">(existingFlow?.trigger_on ?? "both");
  const [conditions, setConditions] = useState<FlowCondition[]>(
    existingFlow?.conditions && existingFlow.conditions.length > 0
      ? existingFlow.conditions
      : [{ field: "source_form_name", operator: "equals", value: "" }]
  );
  const [conditionLogic, setConditionLogic] = useState<"all" | "any">(existingFlow?.condition_logic ?? "all");
  const [webhookUrl, setWebhookUrl] = useState((existingFlow?.action_config as { url?: string })?.url ?? "");
  const [campaignScope, setCampaignScope] = useState<string | null>(existingFlow?.campaign_id ?? activeCampaign?.id ?? null);
  const existingConfig = (existingFlow?.action_config || {}) as Record<string, unknown>;
  const [safetyRequired, setSafetyRequired] = useState({
    no_pii: (existingConfig.safety_required as Record<string, boolean>)?.no_pii ?? false,
    no_profanity: (existingConfig.safety_required as Record<string, boolean>)?.no_profanity ?? false,
    no_hate_speech: (existingConfig.safety_required as Record<string, boolean>)?.no_hate_speech ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; status?: number; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Load personas and forms for condition dropdowns
  const [personas, setPersonas] = useState<string[]>([]);
  const [forms, setForms] = useState<string[]>([]);
  const customFields = useCustomAnalysisFields(tenant, campaignScope, campaigns);

  useEffect(() => {
    if (!tenant) return;
    fetch(`/api/dashboard/taxonomies?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        const buckets = data.buckets ?? [];
        setPersonas(buckets.map((b: { name: string }) => b.name));
      })
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

  // Auto-populate name and description from selections (only if user hasn't manually edited)
  useEffect(() => {
    const campaignMap = Object.fromEntries(campaigns.map((c) => [c.id, c.name]));
    if (!nameEdited) {
      setName(generateName(conditions, webhookUrl, campaignMap));
    }
    if (!descriptionEdited) {
      setDescription(generateDescription(conditions, triggerOn, webhookUrl));
    }
  }, [conditions, webhookUrl, triggerOn, nameEdited, descriptionEdited]);

  async function handleSave() {
    if (!tenant || !name.trim() || !webhookUrl.trim()) return;
    setSaving(true);
    setError(null);

    const cleanConditions = conditions.filter((c) => c.value !== "" && (typeof c.value !== "object" || c.value.length > 0));

    const res = await fetch("/api/dashboard/flows", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEdit ? { flow_id: existingFlow.id } : {}),
        tenant_id: tenant.id,
        campaign_id: campaignScope,
        name: name.trim(),
        description: description.trim() || null,
        trigger_on: triggerOn,
        conditions: cleanConditions,
        condition_logic: conditionLogic,
        action_config: { url: webhookUrl.trim(), safety_required: safetyRequired },
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (data.error) {
      setError(data.error);
      return;
    }

    router.push(isEdit ? `/dashboard/flows/${existingFlow.id}` : "/dashboard/flows");
  }

  async function handleTest() {
    if (!tenant || !webhookUrl.trim()) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/dashboard/flows/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenant.id,
          url: webhookUrl.trim(),
          flow_name: name || "New Flow",
        }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, status: data.status, error: data.error });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setTestResult({ success: false, error: msg });
    }
    setTesting(false);
  }

  const canSave = name.trim() && webhookUrl.trim();

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold mb-1">{isEdit ? "Edit Flow" : "Create Flow"}</h2>
      <p className="text-sm text-muted mb-6">
        {isEdit
          ? "Update your flow's conditions or destination."
          : "Set up an automated action that fires when responses match your conditions."}
      </p>

      {isEdit && (
        <div className="soft-card p-3 mb-6 border-l-2 border-sunshine">
          <p className="text-xs text-muted">
            <strong className="text-foreground">Heads up:</strong> Edits to this flow will only apply to{" "}
            <strong className="text-foreground">new responses</strong> coming in, or to existing responses
            when you <strong className="text-foreground">reanalyze</strong>{" "}them. Past matches won&apos;t be re-fired.
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

      {/* Trigger */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">When does this flow run?</label>
        <div className="flex gap-2">
          {[
            { value: "both", label: "New response or reanalysis" },
            { value: "response_created", label: "New responses only" },
            { value: "person_updated", label: "Person updates only" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTriggerOn(opt.value as typeof triggerOn)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                triggerOn === opt.value
                  ? "bg-accent/15 text-accent font-medium"
                  : "bg-card-border/30 text-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Which responses should match?</label>
        <div className="soft-card p-4">
          <ConditionBuilder
            conditions={conditions}
            conditionLogic={conditionLogic}
            personas={personas}
            forms={forms}
            campaigns={campaigns}
            customFields={customFields}
            onChange={setConditions}
            onLogicChange={setConditionLogic}
          />
        </div>
      </div>

      {/* Action */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Where should we send matching data?</label>
        <div className="soft-card p-4">
          <p className="text-xs text-muted mb-2">
            Paste your Zapier or Make webhook URL. We&apos;ll POST matching response data to this URL.
          </p>
          <details className="text-[11px] text-muted mb-3">
            <summary className="cursor-pointer text-accent hover:underline">Setup tips for Make / Zapier</summary>
            <div className="mt-2 flex flex-col gap-1.5 pl-3 border-l-2 border-card-border">
              <p><strong>Make:</strong> Create a Custom Webhook module → in the webhook settings, leave API Key authentication empty → copy the URL → paste here → click &ldquo;Run once&rdquo; in Make → then click Test below. Make must be listening before the test will work.</p>
              <p><strong>Zapier:</strong> Create a &ldquo;Webhooks by Zapier&rdquo; trigger → choose &ldquo;Catch Hook&rdquo; → copy the URL → paste here → click Test. Zapier is always listening.</p>
              <p>We send JSON with <code className="font-mono bg-card-border/30 px-1 rounded">person</code> (name, email, persona, sentiment, mood) and <code className="font-mono bg-card-border/30 px-1 rounded">response</code> (transcription, themes, source) fields.</p>
            </div>
          </details>
          <div className="flex gap-2">
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => { setWebhookUrl(e.target.value); setTestResult(null); }}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              className="text-sm flex-1"
            />
            <button
              onClick={handleTest}
              disabled={testing || !webhookUrl.trim()}
              className="text-xs text-accent hover:underline disabled:opacity-50 shrink-0 px-2"
            >
              {testing ? "Testing..." : "Test"}
            </button>
          </div>
          {testResult && (
            <p className={`text-xs mt-2 ${testResult.success ? "text-positive" : "text-negative"}`}>
              {testResult.success
                ? `Connected (${testResult.status})`
                : `Failed: ${testResult.error || `HTTP ${testResult.status}`}`}
            </p>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="soft-card p-4 mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Preview</label>
        <FlowPreview
          triggerOn={triggerOn}
          conditions={conditions.filter((c) => c.value !== "" && (typeof c.value !== "object" || c.value.length > 0))}
          conditionLogic={conditionLogic}
          webhookUrl={webhookUrl}
          campaignNames={Object.fromEntries(campaigns.map((c) => [c.id, c.name]))}
        />
      </div>

      {/* Safety filters */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Safety filters</label>
        <div className="soft-card p-4 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={safetyRequired.no_pii} onChange={() => setSafetyRequired({ ...safetyRequired, no_pii: !safetyRequired.no_pii })} />
            Skip responses containing personal information (PII)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={safetyRequired.no_profanity} onChange={() => setSafetyRequired({ ...safetyRequired, no_profanity: !safetyRequired.no_profanity })} />
            Skip responses with profanity
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={safetyRequired.no_hate_speech} onChange={() => setSafetyRequired({ ...safetyRequired, no_hate_speech: !safetyRequired.no_hate_speech })} />
            Skip responses with hate speech or harassment
          </label>
        </div>
      </div>

      {/* Name & Description */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameEdited(true); }}
          placeholder="Auto-generated from your selections"
          className="text-sm w-full"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setDescriptionEdited(true); }}
          placeholder="Optional description"
          className="text-sm w-full mt-2"
        />
      </div>

      {/* Save */}
      {error && (
        <p className="text-xs text-negative mb-3">{error}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="bg-accent text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-accent-hover transition-all shadow-[0_2px_8px_rgba(244,160,122,0.25)] disabled:opacity-50"
        >
          {saving ? "Saving..." : (isEdit ? "Save Changes" : "Create Flow")}
        </button>
        <button
          onClick={() => router.push(isEdit ? `/dashboard/flows/${existingFlow.id}` : "/dashboard/flows")}
          className="text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
