"use client";

import type { FlowCondition } from "../lib/types";

// Built-in structural fields (not from analysis config)
const FIELD_OPTIONS = [
  { value: "campaign", label: "Campaign" },
  { value: "source_form_name", label: "Form" },
  { value: "source_type", label: "Source" },
  { value: "transcription", label: "Transcription" },
];

// Operators for built-in structural fields only
const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
  campaign: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
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

const SOURCE_OPTIONS = [
  { value: "videoask", label: "VideoAsk" },
  { value: "custom", label: "Custom" },
  { value: "csv-import", label: "CSV Import" },
  { value: "videoask-link", label: "VideoAsk Link" },
];

export interface CustomField {
  key: string;         // e.g., "topic" (stored as field in condition)
  label: string;       // e.g., "Topic"
  options?: string[];  // enum values if single_choice
  type?: string;       // "string" | "array" | "number" | "boolean"
}

export function ConditionRow({
  condition,
  personas,
  forms,
  campaigns,
  customFields,
  onChange,
  onRemove,
}: {
  condition: FlowCondition;
  personas: string[];
  forms: string[];
  campaigns?: { id: string; name: string }[];
  customFields?: CustomField[];
  onChange: (updated: FlowCondition) => void;
  onRemove: () => void;
}) {
  // Custom fields get appended to the field options dynamically
  const allFieldOptions = [
    ...FIELD_OPTIONS,
    ...(customFields ?? []).map((cf) => ({ value: cf.key, label: cf.label })),
  ];

  const customField = customFields?.find((cf) => cf.key === condition.field);

  // Custom fields use appropriate operators based on type
  const getOperators = (field: string) => {
    if (OPERATOR_OPTIONS[field]) return OPERATOR_OPTIONS[field];
    const cf = customFields?.find((c) => c.key === field);
    if (cf?.type === "array") {
      return [{ value: "contains", label: "contains" }, { value: "not_contains", label: "does not contain" }];
    }
    if (cf?.options && cf.options.length > 0) {
      return [{ value: "equals", label: "is" }, { value: "not_equals", label: "is not" }, { value: "in", label: "is one of" }];
    }
    return [{ value: "equals", label: "is" }, { value: "not_equals", label: "is not" }];
  };

  const operators = getOperators(condition.field);

  function handleFieldChange(field: string) {
    const newOps = getOperators(field);
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
        // If it's a custom field with enum options, render a dropdown
        if (customField?.options && customField.options.length > 0) {
          return (
            <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
              <option value="">Select...</option>
              {customField.options.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
            </select>
          );
        }
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
        {allFieldOptions.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
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
