"use client";

import type { FlowCondition } from "../lib/types";
import { ConditionRow } from "./ConditionRow";

export function ConditionBuilder({
  conditions,
  conditionLogic,
  personas,
  forms,
  campaigns,
  onChange,
  onLogicChange,
}: {
  conditions: FlowCondition[];
  conditionLogic: "all" | "any";
  personas: string[];
  forms: string[];
  campaigns?: { id: string; name: string }[];
  onChange: (conditions: FlowCondition[]) => void;
  onLogicChange: (logic: "all" | "any") => void;
}) {
  function addCondition() {
    onChange([...conditions, { field: "source_form_name", operator: "equals", value: "" }]);
  }

  function updateCondition(index: number, updated: FlowCondition) {
    const next = [...conditions];
    next[index] = updated;
    onChange(next);
  }

  function removeCondition(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  return (
    <div>
      {conditions.length > 1 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-muted">Match</span>
          <button
            onClick={() => onLogicChange("all")}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              conditionLogic === "all"
                ? "bg-accent/15 text-accent font-medium"
                : "text-muted hover:text-foreground"
            }`}
          >
            ALL conditions
          </button>
          <button
            onClick={() => onLogicChange("any")}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              conditionLogic === "any"
                ? "bg-accent/15 text-accent font-medium"
                : "text-muted hover:text-foreground"
            }`}
          >
            ANY condition
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {conditions.map((c, i) => (
          <ConditionRow
            key={i}
            condition={c}
            personas={personas}
            forms={forms}
            campaigns={campaigns}
            onChange={(updated) => updateCondition(i, updated)}
            onRemove={() => removeCondition(i)}
          />
        ))}
      </div>

      <button
        onClick={addCondition}
        className="mt-3 text-xs text-accent hover:underline"
      >
        + Add condition
      </button>
    </div>
  );
}
