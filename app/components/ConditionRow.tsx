"use client";

import type { FlowCondition } from "../lib/types";

const FIELD_OPTIONS = [
  { value: "campaign", label: "Campaign" },
  { value: "source_form_name", label: "Form" },
  { value: "source_type", label: "Source" },
  { value: "transcription", label: "Transcription" },
  { value: "persona", label: "Persona" },
  { value: "mood", label: "Mood" },
  { value: "themes", label: "Themes" },
  { value: "sentiment", label: "Sentiment" },
];

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
  campaign: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
  ],
  sentiment: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "in", label: "is one of" },
  ],
  mood: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
  ],
  persona: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "in", label: "is one of" },
  ],
  themes: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
  ],
  source_type: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
  ],
  source_form_name: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
  ],
  transcription: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
  ],
};

const SENTIMENT_OPTIONS = ["positive", "negative", "mixed", "neutral"];
const MOOD_OPTIONS = ["hopeful", "frustrated", "enthusiastic", "uncertain", "restless", "curious", "inspired", "casual"];
const SOURCE_OPTIONS = [
  { value: "videoask", label: "VideoAsk" },
  { value: "custom", label: "Custom" },
  { value: "csv-import", label: "CSV Import" },
  { value: "videoask-link", label: "VideoAsk Link" },
];

export function ConditionRow({
  condition,
  personas,
  forms,
  campaigns,
  onChange,
  onRemove,
}: {
  condition: FlowCondition;
  personas: string[];
  forms: string[];
  campaigns?: { id: string; name: string }[];
  onChange: (updated: FlowCondition) => void;
  onRemove: () => void;
}) {
  const operators = OPERATOR_OPTIONS[condition.field] || [{ value: "equals", label: "is" }];

  function handleFieldChange(field: string) {
    const newOps = OPERATOR_OPTIONS[field] || [{ value: "equals", label: "is" }];
    onChange({ field: field as FlowCondition["field"], operator: newOps[0].value as FlowCondition["operator"], value: "" });
  }

  function renderValueInput() {
    switch (condition.field) {
      case "campaign":
        return (
          <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
            <option value="">Select...</option>
            {(campaigns ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        );
      case "sentiment":
        return (
          <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
            <option value="">Select...</option>
            {SENTIMENT_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        );
      case "mood":
        return (
          <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
            <option value="">Select...</option>
            {MOOD_OPTIONS.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        );
      case "persona":
        return (
          <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
            <option value="">Select...</option>
            {personas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        );
      case "source_type":
        return (
          <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
            <option value="">Select...</option>
            {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        );
      case "source_form_name":
        return (
          <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
            <option value="">Select...</option>
            {forms.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        );
      default:
        return (
          <input
            type="text"
            value={condition.value as string}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder="Enter value..."
            className="text-sm flex-1"
          />
        );
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select value={condition.field} onChange={(e) => handleFieldChange(e.target.value)} className="text-sm w-36">
        {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as FlowCondition["operator"] })}
        className="text-sm w-36"
      >
        {operators.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {renderValueInput()}
      <button onClick={onRemove} className="text-muted hover:text-negative text-lg leading-none shrink-0 px-1">&times;</button>
    </div>
  );
}
