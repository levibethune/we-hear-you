"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";
import { ConditionBuilder } from "./ConditionBuilder";
import { useCustomAnalysisFields } from "../hooks/useCustomAnalysisFields";
import type { Flow, FlowCondition } from "../lib/types";

type Channel = "slack" | "in_app" | "email_digest";

const CHANNEL_LABELS: Record<Channel, string> = {
  slack: "Slack",
  in_app: "In-app",
  email_digest: "Email digest (weekly)",
};

const CHANNEL_DESCRIPTIONS: Record<Channel, string> = {
  slack: "Real-time message to a Slack channel via incoming webhook",
  in_app: "Notification appears in your dashboard bell, visible to all org members",
  email_digest: "Bundled into a weekly email digest sent to recipients you choose",
};

export function NotificationForm({ existingFlow }: { existingFlow?: Flow }) {
  const { tenant, campaigns, activeCampaign } = useAuthContext();
  const router = useRouter();
  const isEdit = !!existingFlow;

  const [name, setName] = useState(existingFlow?.name ?? "");
  const [channel, setChannel] = useState<Channel>(
    (existingFlow?.action_type as Channel) || "in_app"
  );
  const [conditions, setConditions] = useState<FlowCondition[]>(
    existingFlow?.conditions && existingFlow.conditions.length > 0
      ? existingFlow.conditions
      : [{ field: "sentiment", operator: "equals", value: "" }]
  );
  const [conditionLogic, setConditionLogic] = useState<"all" | "any">(existingFlow?.condition_logic ?? "all");

  // Channel-specific config
  const initialConfig = (existingFlow?.action_config || {}) as Record<string, unknown>;
  const [slackUrl, setSlackUrl] = useState((initialConfig.webhook_url as string) ?? "");
  const [campaignScope, setCampaignScope] = useState<string | null>(existingFlow?.campaign_id ?? activeCampaign?.id ?? null);
  const existingSafety = (initialConfig.safety_required as Record<string, boolean>) || {};
  const [safetyRequired, setSafetyRequired] = useState({
    no_pii: existingSafety.no_pii ?? false,
    no_profanity: existingSafety.no_profanity ?? false,
    no_hate_speech: existingSafety.no_hate_speech ?? false,
  });
  const [emailRecipients, setEmailRecipients] = useState(
    Array.isArray(initialConfig.recipients) ? (initialConfig.recipients as string[]).join(", ") : ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [personas, setPersonas] = useState<string[]>([]);
  const [forms, setForms] = useState<string[]>([]);
  const customFields = useCustomAnalysisFields(tenant, campaignScope, campaigns);

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

  function buildConfig() {
    const safety = { safety_required: safetyRequired };
    if (channel === "slack") return { webhook_url: slackUrl.trim(), ...safety };
    if (channel === "email_digest") {
      return { recipients: emailRecipients.split(",").map((s) => s.trim()).filter(Boolean), ...safety };
    }
    return safety;
  }

  async function handleSave() {
    if (!tenant || !name.trim()) return;

    if (channel === "slack" && !slackUrl.trim()) {
      setError("Slack webhook URL is required");
      return;
    }
    if (channel === "email_digest" && !emailRecipients.trim()) {
      setError("At least one email recipient is required");
      return;
    }

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
        trigger_on: "both",
        conditions: cleanConditions,
        condition_logic: conditionLogic,
        action_type: channel,
        action_config: buildConfig(),
        category: "notification",
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
    if (!tenant || !existingFlow) return;
    if (!confirm(`Delete "${existingFlow.name}"? This cannot be undone.`)) return;
    await fetch("/api/dashboard/flows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: existingFlow.id, tenant_id: tenant.id }),
    });
    router.push("/dashboard/outputs");
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold mb-1">{isEdit ? "Edit Notification" : "Create Notification"}</h2>
      <p className="text-sm text-muted mb-6">
        Get notified when responses match your conditions.
      </p>

      {isEdit && (
        <div className="soft-card p-3 mb-6 border-l-2 border-sunshine">
          <p className="text-xs text-muted">
            <strong className="text-foreground">Heads up:</strong> Edits will only apply to{" "}
            <strong className="text-foreground">new responses</strong> coming in, or to existing responses
            when you <strong className="text-foreground">reanalyze</strong> them.
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

      {/* Channel */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Channel</label>
        <div className="flex flex-col gap-2">
          {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`text-left p-3 rounded-xl transition-colors ${
                channel === c
                  ? "bg-accent/10 border border-accent/40"
                  : "bg-card-border/20 border border-transparent hover:border-card-border"
              }`}
            >
              <div className={`text-sm font-medium ${channel === c ? "text-accent" : ""}`}>
                {CHANNEL_LABELS[c]}
              </div>
              <div className="text-xs text-muted mt-0.5">{CHANNEL_DESCRIPTIONS[c]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Channel-specific config */}
      {channel === "slack" && (
        <div className="mb-6">
          <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Slack webhook URL</label>
          <div className="soft-card p-4">
            <p className="text-xs text-muted mb-2">
              Create an incoming webhook in Slack and paste the URL here.{" "}
              <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener" className="text-accent hover:underline">
                Learn how
              </a>
            </p>
            <input
              type="url"
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="text-sm w-full"
            />
          </div>
        </div>
      )}

      {channel === "email_digest" && (
        <div className="mb-6">
          <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Email recipients</label>
          <div className="soft-card p-4">
            <p className="text-xs text-muted mb-2">
              Comma-separated email addresses. They&apos;ll get a weekly digest of all matching responses.
            </p>
            <input
              type="text"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder="you@example.com, teammate@example.com"
              className="text-sm w-full"
            />
          </div>
        </div>
      )}

      {channel === "in_app" && (
        <div className="mb-6">
          <div className="soft-card p-4">
            <p className="text-xs text-muted">
              In-app notifications appear in the bell icon in your dashboard sidebar. All org members can see and dismiss them.
            </p>
          </div>
        </div>
      )}

      {/* Conditions */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Which responses should trigger this?</label>
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

      {/* Name */}
      <div className="mb-6">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Negative feedback alerts"
          className="text-sm w-full"
        />
      </div>

      {error && <p className="text-xs text-negative mb-3">{error}</p>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-accent text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-accent-hover transition-all shadow-[0_2px_8px_rgba(244,160,122,0.25)] disabled:opacity-50"
          >
            {saving ? "Saving..." : (isEdit ? "Save Changes" : "Create Notification")}
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
