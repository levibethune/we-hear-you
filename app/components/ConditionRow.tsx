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
  conditions,
  currentIndex,
  conditionLogic,
  personas,
  forms,
  campaigns,
  customFields,
  onChange,
  onRemove,
}: {
  condition: FlowCondition;
  conditions: FlowCondition[];
  currentIndex: number;
  conditionLogic: "all" | "any";
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

  // In ALL mode, predict which values would create an unsatisfiable filter
  // (e.g. Campaign equals X AND Campaign equals Y — a response only has one).
  // Returns either a Set of disallowed values, or { allowedOnly } meaning
  // any value other than the listed ones is disallowed.
  const blocked = (() => {
    if (conditionLogic !== "all") return { disabled: new Set<string>(), allowedOnly: null as Set<string> | null };
    const disabled = new Set<string>();
    let allowedOnly: Set<string> | null = null;
    conditions.forEach((c, i) => {
      if (i === currentIndex) return;
      if (c.field !== condition.field) return;
      if (c.value == null || c.value === "") return;
      const sibVal = String(c.value);
      // current=equals + sibling=equals → only sibling's value satisfies both
      if (condition.operator === "equals" && c.operator === "equals") {
        if (!allowedOnly) allowedOnly = new Set();
        allowedOnly.add(sibVal);
      }
      // current=equals + sibling=not_equals → can't pick sibling's value
      if (condition.operator === "equals" && c.operator === "not_equals") {
        disabled.add(sibVal);
      }
      // current=not_equals + sibling=equals → can't pick sibling's value
      if (condition.operator === "not_equals" && c.operator === "equals") {
        disabled.add(sibVal);
      }
    });
    return { disabled, allowedOnly };
  })();

  function isOptionBlocked(val: string): boolean {
    // Never disable the currently selected value — keeps existing flows readable
    // even if they're already in conflict (the warning + Save block handle that).
    if (val === String(condition.value ?? "")) return false;
    if (blocked.disabled.has(val)) return true;
    if (blocked.allowedOnly && !blocked.allowedOnly.has(val)) return true;
    return false;
  }

  const hasConflict = blocked.disabled.size > 0 || blocked.allowedOnly !== null;
  const fieldName = condition.field === "campaign" ? "campaigns" : condition.field === "source_form_name" ? "forms" : "values";

  function handleFieldChange(field: string) {
    const newOps = getOperators(field);
    onChange({ field: field as FlowCondition["field"], operator: newOps[0].value as FlowCondition["operator"], value: "" });
  }

  function handleOperatorChange(newOp: FlowCondition["operator"]) {
    // Clear value if the operator change would create an unsatisfiable state
    // with the current value — forces a re-pick under the new constraints.
    onChange({ ...condition, operator: newOp, value: "" });
  }

  function renderValueInput() {
    switch (condition.field) {
      case "campaign":
        return (
          <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
            <option value="">Select...</option>
            {(campaigns ?? []).map((c) => <option key={c.id} value={c.id} disabled={isOptionBlocked(c.id)}>{c.name}</option>)}
          </select>
        );
      case "source_type":
        return (
          <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
            <option value="">Select...</option>
            {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value} disabled={isOptionBlocked(s.value)}>{s.label}</option>)}
          </select>
        );
      case "source_form_name":
        return (
          <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
            <option value="">Select...</option>
            {forms.map((f) => <option key={f} value={f} disabled={isOptionBlocked(f)}>{f}</option>)}
          </select>
        );
      default:
        // If it's a custom field with enum options, render a dropdown
        if (customField?.options && customField.options.length > 0) {
          return (
            <select value={condition.value as string} onChange={(e) => onChange({ ...condition, value: e.target.value })} className="text-sm flex-1">
              <option value="">Select...</option>
              {customField.options.map((o) => <option key={o} value={o} disabled={isOptionBlocked(o)}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
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
    <div>
      <div className="flex items-center gap-2">
        <select value={condition.field} onChange={(e) => handleFieldChange(e.target.value)} className="text-sm w-36">
          {allFieldOptions.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select
          value={condition.operator}
          onChange={(e) => handleOperatorChange(e.target.value as FlowCondition["operator"])}
          className="text-sm w-36"
        >
          {operators.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {renderValueInput()}
        <button onClick={onRemove} className="text-muted hover:text-negative text-lg leading-none shrink-0 px-1">&times;</button>
      </div>
      {hasConflict && (
        <p className="text-xs text-muted mt-1 ml-1">
          Other {fieldName} are disabled because every condition must match. Switch to <strong>Match ANY</strong> at the top to filter by multiple {fieldName}.
        </p>
      )}
    </div>
  );
}
