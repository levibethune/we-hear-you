"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";
import { ConditionBuilder } from "./ConditionBuilder";
import { useCustomAnalysisFields } from "../hooks/useCustomAnalysisFields";
import type { Flow, FlowCondition, WebflowActionConfig } from "../lib/types";

interface WebflowSite { id: string; name: string }
interface WebflowCollection { id: string; name: string; slug: string }
interface WebflowField { id: string; slug: string; name: string; type: string; required: boolean }

// Default WHY fields available for mapping
const BUILTIN_FIELDS = [
  { key: "response_id", label: "Response ID" },
  { key: "person_id", label: "Person ID" },
  { key: "person_name", label: "Person Name" },
  { key: "person_email", label: "Person Email" },
  { key: "persona", label: "Persona" },
  { key: "mood", label: "Mood" },
  { key: "sentiment", label: "Sentiment" },
  { key: "transcription", label: "Transcription" },
  { key: "themes", label: "Themes" },
  { key: "video_url", label: "Video URL (raw)" },
  { key: "video_embed_url", label: "Video Embed Page (iframe-friendly)" },
  { key: "source_form_name", label: "Form Name" },
  { key: "created_at", label: "Date" },
];

const FIELD_LABELS: Record<string, string> = {
  campaign: "Campaign",
  source_form_name: "Form",
  source_type: "Source",
  transcription: "Transcription",
};

const OPERATOR_LABELS: Record<string, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  not_contains: "does not contain",
  in: "is one of",
  not_in: "is not one of",
};

const SOURCE_VALUE_LABELS: Record<string, string> = {
  videoask: "VideoAsk",
  custom: "Custom",
  "csv-import": "CSV Import",
  "videoask-link": "VideoAsk Link",
};

function describeValue(
  field: string,
  value: unknown,
  campaigns: { id: string; name: string }[],
  customFields: { key: string; label: string }[]
): string {
  if (value == null || value === "") return "(empty)";
  if (Array.isArray(value)) return value.map((v) => describeValue(field, v, campaigns, customFields)).join(", ");
  const str = String(value);
  if (field === "campaign") {
    const c = campaigns.find((c) => c.id === str);
    return c ? `"${c.name}"` : `"${str}"`;
  }
  if (field === "source_type") return `"${SOURCE_VALUE_LABELS[str] ?? str}"`;
  return `"${str}"`;
}

function fieldLabel(field: string, customFields: { key: string; label: string }[]): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const cf = customFields.find((c) => c.key === field);
  return cf?.label ?? field;
}

function describeCondition(
  c: FlowCondition,
  campaigns: { id: string; name: string }[],
  customFields: { key: string; label: string }[]
): string {
  const f = fieldLabel(c.field, customFields);
  const op = OPERATOR_LABELS[c.operator] ?? c.operator;
  const v = describeValue(c.field, c.value, campaigns, customFields);
  return `${f} ${op} ${v}`;
}

// Detects filters that can never match under ALL logic:
//   1. Same field with multiple distinct `equals` values
//      (e.g. Campaign is X AND Campaign is Y — a response only has one)
//   2. Same field with `equals X` AND `not_equals X`
function detectUnsatisfiable(
  conditions: FlowCondition[],
  logic: "all" | "any"
): { field: string; reason: "multiple-equals" | "equals-and-not-equals" } | null {
  if (logic !== "all") return null;
  const equalsByField: Record<string, Set<string>> = {};
  const notEqualsByField: Record<string, Set<string>> = {};
  for (const c of conditions) {
    if (c.value == null || c.value === "") continue;
    const key = c.field as string;
    if (c.operator === "equals") {
      if (!equalsByField[key]) equalsByField[key] = new Set();
      equalsByField[key].add(String(c.value));
    } else if (c.operator === "not_equals") {
      if (!notEqualsByField[key]) notEqualsByField[key] = new Set();
      notEqualsByField[key].add(String(c.value));
    }
  }
  for (const [field, vals] of Object.entries(equalsByField)) {
    if (vals.size > 1) return { field, reason: "multiple-equals" };
  }
  for (const [field, eqVals] of Object.entries(equalsByField)) {
    const neqVals = notEqualsByField[field];
    if (!neqVals) continue;
    for (const v of eqVals) if (neqVals.has(v)) return { field, reason: "equals-and-not-equals" };
  }
  return null;
}

// Auto-map WHY field keys to common Webflow field slug patterns
function autoMapFields(whyKey: string, webflowFields: WebflowField[]): string {
  const candidates: Record<string, string[]> = {
    response_id: ["slug", "response-id", "id", "external-id"],
    video_embed_url: ["video-embed", "video-page", "video-embed-url", "embed-url"],
    person_id: ["person-id", "author-id"],
    person_name: ["name", "person-name", "author", "author-name"],
    person_email: ["email", "person-email", "author-email"],
    persona: ["persona", "category"],
    mood: ["mood", "tone"],
    sentiment: ["sentiment"],
    transcription: ["transcription", "transcript", "content", "body", "description"],
    themes: ["themes", "tags", "topics"],
    video_url: ["video-url", "video", "media", "media-url"],
    source_form_name: ["source", "form", "campaign"],
    created_at: ["date", "created-at", "published-on"],
  };
  const options = candidates[whyKey] || [whyKey];
  for (const candidate of options) {
    const match = webflowFields.find((f) => f.slug === candidate);
    if (match) return match.slug;
  }
  return "";
}

export function WebflowForm({ existingFlow }: { existingFlow?: Flow }) {
  const { tenant, campaigns, activeCampaign } = useAuthContext();
  const router = useRouter();
  const isEdit = !!existingFlow;
  const cfg = (existingFlow?.action_config || {}) as Partial<WebflowActionConfig>;

  const [connected, setConnected] = useState<boolean | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [sites, setSites] = useState<WebflowSite[]>([]);
  const [collections, setCollections] = useState<WebflowCollection[]>([]);
  const [webflowFields, setWebflowFields] = useState<WebflowField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldsKey, setFieldsKey] = useState(0);

  const [siteId, setSiteId] = useState(cfg.site_id ?? "");
  const [siteName, setSiteName] = useState(cfg.site_name ?? "");
  const [collectionId, setCollectionId] = useState(cfg.collection_id ?? "");
  const [collectionName, setCollectionName] = useState(cfg.collection_name ?? "");
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(cfg.field_mapping ?? {});
  const [autoPublish, setAutoPublish] = useState(cfg.auto_publish ?? false);
  const cfgEmbed = (cfg as Record<string, unknown>).embed_options as Record<string, unknown> | undefined;
  const [embedOptions, setEmbedOptions] = useState({
    showName: cfgEmbed?.showName !== false,
    showPersona: cfgEmbed?.showPersona !== false,
    showMood: cfgEmbed?.showMood !== false,
    showSentiment: cfgEmbed?.showSentiment !== false,
    showProgress: cfgEmbed?.showProgress !== false,
    showTime: cfgEmbed?.showTime !== false,
    accentColor: (cfgEmbed?.accentColor as string) || "#f4a07a",
    customFieldsVisible: (cfgEmbed?.customFieldsVisible as string[]) ?? [],
  });
  const [previewResponseId, setPreviewResponseId] = useState<string | null>(null);

  const [name, setName] = useState(existingFlow?.name ?? "");
  const [conditions, setConditions] = useState<FlowCondition[]>(
    existingFlow?.conditions && existingFlow.conditions.length > 0
      ? existingFlow.conditions
      : []
  );
  const [conditionLogic, setConditionLogic] = useState<"all" | "any">(existingFlow?.condition_logic ?? "all");
  const [campaignScope, setCampaignScope] = useState<string | null>(existingFlow?.campaign_id ?? activeCampaign?.id ?? null);
  const [safetyRequired, setSafetyRequired] = useState({
    no_pii: cfg.safety_required?.no_pii ?? true,
    no_profanity: cfg.safety_required?.no_profanity ?? true,
    no_hate_speech: cfg.safety_required?.no_hate_speech ?? true,
  });

  const [personas, setPersonas] = useState<string[]>([]);
  const [forms, setForms] = useState<string[]>([]);
  const conditionCustomFields = useCustomAnalysisFields(tenant, campaignScope, campaigns);

  // Fetch a sample response for embed preview
  useEffect(() => {
    if (!tenant) return;
    const cp = campaignScope ? `&campaign_id=${campaignScope}` : "";
    fetch(`/api/dashboard/responses?tenant_id=${tenant.id}${cp}&per_page=1`)
      .then((r) => r.json())
      .then((data) => {
        const resp = data.responses?.[0];
        if (resp?.video_url) setPreviewResponseId(resp.id);
      })
      .catch(() => {});
  }, [tenant, campaignScope]);
  // Convert to webflow form's mapping shape: analysis_<key>
  const customAnalysisFields = conditionCustomFields.map((cf) => ({
    key: `analysis_${cf.key}`,
    label: cf.label,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ sent: number; skipped: number; failed: number; total: number; errors?: string[] } | null>(null);

  // Check connection status
  useEffect(() => {
    if (!tenant) return;
    fetch(`/api/dashboard/webflow?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => setConnected(data.connected ?? false))
      .catch(() => setConnected(false));
  }, [tenant]);

  // Load sites once connected
  useEffect(() => {
    if (!tenant || !connected) return;
    fetch(`/api/dashboard/webflow/sites?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => setSites(data.sites ?? []))
      .catch(() => {});
  }, [tenant, connected]);

  // Load collections when site selected
  useEffect(() => {
    if (!tenant || !siteId) { setCollections([]); return; }
    fetch(`/api/dashboard/webflow/collections?tenant_id=${tenant.id}&site_id=${siteId}`)
      .then((r) => r.json())
      .then((data) => setCollections(data.collections ?? []))
      .catch(() => {});
  }, [tenant, siteId]);

  // Load fields when collection selected (or on refresh)
  useEffect(() => {
    if (!tenant || !collectionId) { setWebflowFields([]); return; }
    setLoadingFields(true);
    fetch(`/api/dashboard/webflow/collections?tenant_id=${tenant.id}&collection_id=${collectionId}`)
      .then((r) => r.json())
      .then((data) => {
        const fields: WebflowField[] = data.fields ?? [];
        setWebflowFields(fields);
        setLoadingFields(false);
        // Auto-map built-ins if no mapping set yet
        if (Object.keys(fieldMapping).length === 0) {
          const autoMap: Record<string, string> = {};
          for (const wf of BUILTIN_FIELDS) {
            const match = autoMapFields(wf.key, fields);
            if (match) autoMap[wf.key] = match;
          }
          setFieldMapping(autoMap);
        }
      })
      .catch(() => setLoadingFields(false));
  }, [tenant, collectionId, fieldsKey]);

  // Load personas + forms + custom analysis fields based on campaign scope
  useEffect(() => {
    if (!tenant) return;
    const scopeParam = campaignScope ? `&campaign_id=${campaignScope}` : "";

    fetch(`/api/dashboard/taxonomies?tenant_id=${tenant.id}${scopeParam}`)
      .then((r) => r.json())
      .then((data) => setPersonas((data.buckets ?? []).map((b: { name: string }) => b.name)))
      .catch(() => {});

    fetch(`/api/dashboard/responses?tenant_id=${tenant.id}${scopeParam}&per_page=100`)
      .then((r) => r.json())
      .then((data) => {
        const names = new Set<string>();
        for (const r of data.responses ?? []) {
          if (r.source_form_name) names.add(r.source_form_name);
        }
        setForms(Array.from(names));
      })
      .catch(() => {});

  }, [tenant, campaignScope]);

  // Combined field list: built-ins + custom analysis fields
  const whyFields = [...BUILTIN_FIELDS, ...customAnalysisFields];

  // Detect filters that can never match, so we can warn the user and block Save.
  const validConditionsForCheck = conditions.filter((c) => c.value !== "" && (typeof c.value !== "object" || (Array.isArray(c.value) && c.value.length > 0)));
  const unsatisfiable = detectUnsatisfiable(validConditionsForCheck, conditionLogic);

  // Auto-map custom analysis fields when they load (if not already mapped)
  useEffect(() => {
    if (webflowFields.length === 0 || customAnalysisFields.length === 0) return;
    const additions: Record<string, string> = {};
    for (const caf of customAnalysisFields) {
      if (fieldMapping[caf.key]) continue; // already mapped
      // Try matching by the bare field name (strip "analysis_" prefix) against webflow slugs
      const bareName = caf.key.slice("analysis_".length);
      const slugified = bareName.replace(/_/g, "-");
      const match = webflowFields.find((f) => f.slug === slugified || f.slug === bareName);
      if (match) additions[caf.key] = match.slug;
    }
    if (Object.keys(additions).length > 0) {
      setFieldMapping((prev) => ({ ...prev, ...additions }));
    }
  }, [webflowFields, customAnalysisFields]);

  async function handleSaveToken() {
    if (!tenant || !apiToken.trim()) return;
    setTokenSaving(true);
    setTokenError(null);
    const res = await fetch("/api/dashboard/webflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant.id, api_token: apiToken.trim() }),
    });
    const data = await res.json();
    setTokenSaving(false);
    if (data.error) {
      setTokenError(data.error);
    } else {
      setConnected(true);
      setApiToken("");
    }
  }

  async function handleSave() {
    if (!tenant) return;
    if (!collectionId) { setError("Please select a Webflow collection"); return; }
    if (Object.values(fieldMapping).filter(Boolean).length === 0) { setError("Please map at least one field"); return; }
    setSaving(true);
    setError(null);

    const cleanMapping: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldMapping)) if (v) cleanMapping[k] = v;

    const finalName = name.trim() || `${collectionName} → Webflow`;

    const res = await fetch("/api/dashboard/flows", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEdit ? { flow_id: existingFlow.id } : {}),
        tenant_id: tenant.id,
        campaign_id: campaignScope,
        name: finalName,
        trigger_on: "both",
        conditions: conditions.filter((c) => c.value !== "" && (typeof c.value !== "object" || c.value.length > 0)),
        condition_logic: conditionLogic,
        action_type: "webflow",
        action_config: {
          site_id: siteId,
          site_name: siteName,
          collection_id: collectionId,
          collection_name: collectionName,
          field_mapping: cleanMapping,
          auto_publish: autoPublish,
          embed_options: embedOptions,
          safety_required: safetyRequired,
        },
        category: "webflow",
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

  async function handleBackfill(limit: number) {
    if (!tenant || !existingFlow) return;
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/dashboard/webflow/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenant.id, flow_id: existingFlow.id, limit }),
      });
      const data = await res.json();
      setBackfillResult(data);
    } catch {
      setBackfillResult({ sent: 0, skipped: 0, failed: 0, total: 0, errors: ["Request failed"] });
    }
    setBackfilling(false);
  }

  async function handleDelete() {
    if (!tenant || !existingFlow) return;
    if (!confirm(`Delete "${existingFlow.name}"?`)) return;
    await fetch("/api/dashboard/flows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: existingFlow.id, tenant_id: tenant.id }),
    });
    router.push("/dashboard/outputs");
  }

  if (connected === null) {
    return <div className="max-w-2xl text-sm text-muted">Loading…</div>;
  }

  // Step 1: Connect token
  if (!connected) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-lg font-bold mb-1">Connect Webflow</h2>
        <p className="text-sm text-muted mb-6">
          Paste your Webflow API token to let WHY publish responses directly to your CMS.
        </p>
        <div className="soft-card p-5 mb-4">
          <details className="text-xs text-muted mb-3">
            <summary className="cursor-pointer text-accent hover:underline">How to get a Webflow API token</summary>
            <ol className="mt-2 pl-4 list-decimal flex flex-col gap-1.5">
              <li>Open the Webflow site where you want responses published</li>
              <li>Go to <strong>Site Settings</strong> → <strong>Apps &amp; Integrations</strong> → <strong>API Access</strong></li>
              <li>Click <strong>Generate API token</strong></li>
              <li>Set these permissions (required):
                <ul className="pl-4 list-disc mt-1">
                  <li><strong>Sites: Read-only</strong></li>
                  <li><strong>CMS: Read and write</strong></li>
                </ul>
              </li>
              <li>Click <strong>Generate token</strong> and paste it below</li>
            </ol>
            <p className="mt-2 text-muted/70">
              Site tokens are scoped to one site — perfect if you plan to move the site to different workspaces later. For multi-site access, use a Workspace token (Workspace Settings → Integrations) instead.
            </p>
          </details>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Paste your Webflow API token…"
            className="text-sm w-full mb-3"
          />
          <button
            onClick={handleSaveToken}
            disabled={tokenSaving || !apiToken.trim()}
            className="bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
          >
            {tokenSaving ? "Validating…" : "Connect"}
          </button>
          {tokenError && <p className="text-xs text-negative mt-2">{tokenError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold mb-1">{isEdit ? "Edit Webflow Output" : "New Webflow Output"}</h2>
      <p className="text-sm text-muted mb-6">
        Publish matching responses directly to your Webflow CMS collection.
      </p>

      {/* Campaign scope */}
      {campaigns.length > 1 && (
        <div className="mb-6">
          <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Scope</label>
          <select value={campaignScope ?? ""} onChange={(e) => setCampaignScope(e.target.value || null)} className="text-sm">
            <option value="">All Campaigns (org-wide)</option>
            {campaigns.filter((c) => !c.is_archived).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Conditions — first so custom analysis fields can be discovered from the campaign */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Which responses should publish?</label>
        <div className="soft-card p-4">
          <ConditionBuilder
            conditions={conditions}
            conditionLogic={conditionLogic}
            personas={personas}
            forms={forms}
            campaigns={campaigns}
            customFields={conditionCustomFields}
            onChange={setConditions}
            onLogicChange={setConditionLogic}
          />
        </div>
      </div>

      {/* Destination */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Destination</label>
        <div className="soft-card p-4 flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Site</label>
            <select
              value={siteId}
              onChange={(e) => {
                const s = sites.find((s) => s.id === e.target.value);
                setSiteId(e.target.value);
                setSiteName(s?.name ?? "");
                setCollectionId("");
                setCollectionName("");
              }}
              className="text-sm w-full"
            >
              <option value="">Select a site…</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {siteId && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted">Collection</label>
                {collectionId && (
                  <button
                    type="button"
                    onClick={() => { setFieldMapping({}); setFieldsKey((k) => k + 1); }}
                    className="text-[10px] text-accent hover:underline"
                  >
                    Refresh fields
                  </button>
                )}
              </div>
              <select
                value={collectionId}
                onChange={(e) => {
                  const c = collections.find((c) => c.id === e.target.value);
                  setCollectionId(e.target.value);
                  setCollectionName(c?.name ?? "");
                  setFieldMapping({});
                }}
                className="text-sm w-full"
              >
                <option value="">Select a collection…</option>
                {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Field mapping */}
      {collectionId && (
        <div className="mb-6">
          <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Field Mapping</label>
          <div className="soft-card p-4">
            {loadingFields ? (
              <div className="flex items-center gap-2 py-4">
                <div className="h-1.5 w-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-seafoam/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-sunshine/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="text-xs text-muted ml-1">Loading Webflow fields…</span>
              </div>
            ) : webflowFields.length === 0 ? (
              <p className="text-xs text-muted">No fields found in this collection.</p>
            ) : (
              <>
            <p className="text-xs text-muted mb-3">Map your WHY response fields to Webflow collection fields. Auto-matched when possible.</p>
            <div className="flex flex-col gap-2">
              {whyFields.map((wf) => (
                <div key={wf.key} className="flex items-center gap-2">
                  <span className="text-xs w-32 truncate">{wf.label}</span>
                  <span className="text-xs text-muted">→</span>
                  <select
                    value={fieldMapping[wf.key] ?? ""}
                    onChange={(e) => setFieldMapping({ ...fieldMapping, [wf.key]: e.target.value })}
                    className="text-xs flex-1"
                  >
                    <option value="">(not mapped)</option>
                    {webflowFields.map((f) => (
                      <option key={f.id} value={f.slug}>{f.name}{f.required ? " *" : ""}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Embed player options */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Video embed player</label>
        <div className="soft-card p-4">
          <p className="text-xs text-muted mb-3">Customize what appears in the embedded video player.</p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={embedOptions.showName} onChange={() => setEmbedOptions({ ...embedOptions, showName: !embedOptions.showName })} />
              Person name
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={embedOptions.showPersona} onChange={() => setEmbedOptions({ ...embedOptions, showPersona: !embedOptions.showPersona })} />
              Persona
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={embedOptions.showMood} onChange={() => setEmbedOptions({ ...embedOptions, showMood: !embedOptions.showMood })} />
              Mood
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={embedOptions.showSentiment} onChange={() => setEmbedOptions({ ...embedOptions, showSentiment: !embedOptions.showSentiment })} />
              Sentiment
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={embedOptions.showProgress} onChange={() => setEmbedOptions({ ...embedOptions, showProgress: !embedOptions.showProgress })} />
              Progress bar
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={embedOptions.showTime} onChange={() => setEmbedOptions({ ...embedOptions, showTime: !embedOptions.showTime })} />
              Timestamp
            </label>
            {/* Custom analysis fields */}
            {conditionCustomFields.map((cf) => (
              <label key={cf.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={embedOptions.customFieldsVisible.includes(cf.key)}
                  onChange={() => {
                    const vis = embedOptions.customFieldsVisible.includes(cf.key)
                      ? embedOptions.customFieldsVisible.filter((k) => k !== cf.key)
                      : [...embedOptions.customFieldsVisible, cf.key];
                    setEmbedOptions({ ...embedOptions, customFieldsVisible: vis });
                  }}
                />
                {cf.label}
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <label className="text-xs text-muted">Accent color</label>
            <input
              type="color"
              value={embedOptions.accentColor}
              onChange={(e) => setEmbedOptions({ ...embedOptions, accentColor: e.target.value })}
              className="w-6 h-6 border-0 rounded cursor-pointer"
              style={{ padding: 0, minHeight: "unset" }}
            />
            <span className="text-[10px] text-muted font-mono">{embedOptions.accentColor}</span>
          </div>

          {/* Live preview */}
          {previewResponseId && (
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Preview</p>
              <div className="rounded-lg overflow-hidden border border-card-border" style={{ aspectRatio: "16/9" }}>
                <iframe
                  key={JSON.stringify(embedOptions)}
                  src={`/embed/response/${previewResponseId}?${[
                    !embedOptions.showName ? "name=0" : "",
                    !embedOptions.showPersona ? "persona=0" : "",
                    !embedOptions.showMood ? "mood=0" : "",
                    !embedOptions.showSentiment ? "sentiment=0" : "",
                    !embedOptions.showProgress ? "progress=0" : "",
                    !embedOptions.showTime ? "time=0" : "",
                    embedOptions.accentColor !== "#f4a07a" ? `accent=${encodeURIComponent(embedOptions.accentColor)}` : "",
                    // Hide custom fields not in visible list
                    ...conditionCustomFields
                      .filter((cf) => !embedOptions.customFieldsVisible.includes(cf.key))
                      .map((cf) => `cf_${cf.key}=0`),
                  ].filter(Boolean).join("&")}`}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Embed code for Webflow */}
          <div className="mt-4 pt-3 border-t border-card-border">
            <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Webflow embed code</p>
            <p className="text-xs text-muted mb-2">
              In Webflow, add an HTML Embed element and paste this code. Replace <code className="font-mono bg-card-border/30 px-1 rounded">{"{{video-embed-url}}"}</code> with your CMS field reference.
            </p>
            <div className="flex items-center gap-2">
              <code className="text-[11px] font-mono bg-card-border/30 px-3 py-2 rounded flex-1 break-all select-all">
                {`<iframe src="{{video-embed-url}}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>`}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(`<iframe src="{{video-embed-url}}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>`)}
                className="text-[10px] text-accent hover:underline shrink-0"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Safety + publish mode */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Safety & publishing</label>
        <div className="soft-card p-4 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} />
            Publish items live (otherwise saved as drafts)
          </label>
          <div className="h-px bg-card-border my-1" />
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

      {/* Name */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={collectionName ? `${collectionName} → Webflow` : "Auto-generated from your selections"}
          className="text-sm w-full"
        />
      </div>

      {/* Send past responses (edit mode only) */}
      {isEdit && (
        <div className="mb-6">
          <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Send past responses</label>
          <div className="soft-card p-4">
            <p className="text-xs text-muted mb-3">
              Manually send responses that already exist in your database to Webflow. Only responses matching your conditions and safety filters will be published.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleBackfill(25)}
                disabled={backfilling}
                className="text-xs text-accent hover:underline disabled:opacity-50"
              >
                {backfilling ? "Sending..." : "Send last 25"}
              </button>
              <span className="text-muted/40">|</span>
              <button
                type="button"
                onClick={() => handleBackfill(50)}
                disabled={backfilling}
                className="text-xs text-accent hover:underline disabled:opacity-50"
              >
                Send last 50
              </button>
              <span className="text-muted/40">|</span>
              <button
                type="button"
                onClick={() => handleBackfill(100)}
                disabled={backfilling}
                className="text-xs text-accent hover:underline disabled:opacity-50"
              >
                Send last 100
              </button>
            </div>
            {backfillResult && (
              <div className="mt-3 text-xs">
                <p>
                  <span className="text-positive">{backfillResult.sent} sent</span>
                  {backfillResult.skipped > 0 && <span className="text-muted"> · {backfillResult.skipped} skipped (didn&apos;t match)</span>}
                  {backfillResult.failed > 0 && <span className="text-negative"> · {backfillResult.failed} failed</span>}
                </p>
                {backfillResult.errors && backfillResult.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted hover:text-foreground">Show errors</summary>
                    <ul className="mt-1 pl-4 list-disc text-negative/80">
                      {backfillResult.errors.map((e, i) => <li key={i} className="font-mono text-[10px]">{e}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plain-language summary */}
      {(collectionName || conditions.length > 0) && (() => {
        const validConditions = validConditionsForCheck;
        const joiner = conditionLogic === "all" ? " AND " : " OR ";
        const conditionPhrases = validConditions.map((c) => describeCondition(c, campaigns, customAnalysisFields));
        const scopeLabel = campaignScope
          ? campaigns.find((c) => c.id === campaignScope)?.name
          : null;
        const safetyParts: string[] = [];
        if (safetyRequired.no_pii) safetyParts.push("personal info");
        if (safetyRequired.no_profanity) safetyParts.push("profanity");
        if (safetyRequired.no_hate_speech) safetyParts.push("hate speech");

        return (
          <div className="mb-6">
            <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">What this output will do</label>
            <div className="soft-card p-4 text-sm flex flex-col gap-2">
              <p>
                Publishes responses
                {scopeLabel ? <> from <strong>{scopeLabel}</strong></> : <> from <strong>any campaign</strong></>}
                {collectionName ? <> to the <strong>{collectionName}</strong> collection{siteName ? <> in <strong>{siteName}</strong></> : null}</> : null}
                {", "}
                {autoPublish ? "published live" : "saved as drafts"}.
              </p>
              {validConditions.length === 0 ? (
                <p className="text-muted">No filters set — every response will publish (subject to safety filters below).</p>
              ) : (
                <p className="text-muted">
                  Only when: {conditionPhrases.join(joiner)}
                </p>
              )}
              {safetyParts.length > 0 && (
                <p className="text-muted">Skips responses containing {safetyParts.join(", ")}.</p>
              )}
              {unsatisfiable && (
                <p className="text-negative mt-1">
                  {unsatisfiable.reason === "multiple-equals" ? (
                    <>Heads up — this filter can never match. <strong>{fieldLabel(unsatisfiable.field, customAnalysisFields)}</strong> is being checked against multiple values with ALL logic, but a response only has one. Switch to <strong>Match ANY condition</strong> if you want either value to qualify.</>
                  ) : (
                    <>Heads up — this filter can never match. <strong>{fieldLabel(unsatisfiable.field, customAnalysisFields)}</strong> is set to both <em>is</em> and <em>is not</em> the same value under ALL logic, which can never both be true. Remove one of the conditions.</>
                  )}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {error && <p className="text-xs text-negative mb-3">{error}</p>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !!unsatisfiable}
            title={unsatisfiable ? "Fix the filter conflict above before saving" : undefined}
            className="bg-accent text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : (isEdit ? "Save Changes" : "Create Webflow Output")}
          </button>
          <button onClick={() => router.push("/dashboard/outputs")} className="text-sm text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
        {isEdit && (
          <button onClick={handleDelete} className="text-xs text-negative hover:underline">Delete</button>
        )}
      </div>
    </div>
  );
}
